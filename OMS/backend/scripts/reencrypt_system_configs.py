"""Re-encrypt OMS system configuration values after a Fernet key rotation.

The old key is intentionally supplied only through FERNET_KEY_OLD at runtime.
This module uses raw SQL for the ciphertext column so the ORM's current-key
type decorator cannot try to decrypt or double-encrypt values during rotation.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class ReencryptResult:
    changed_keys: tuple[str, ...]

    @property
    def changed_count(self) -> int:
        return len(self.changed_keys)


def _load_fernet(value: str | None, name: str) -> Fernet:
    if not value:
        raise RuntimeError(f"{name} environment variable is required")
    try:
        return Fernet(value.encode())
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"{name} must be a valid Fernet key") from exc


def reencrypt_system_configs(
    session: Session,
    old_key: str,
    new_key: str,
    *,
    dry_run: bool = False,
) -> ReencryptResult:
    """Rotate all system-config ciphertexts in the caller's transaction.

    Rows already decryptable by ``new_key`` are left untouched, which makes a
    retry safe after an interrupted deployment. A row that decrypts with
    neither key aborts the transaction and identifies only its config key.
    """

    old_fernet = _load_fernet(old_key, "FERNET_KEY_OLD")
    new_fernet = _load_fernet(new_key, "FERNET_KEY")
    changed_keys: list[str] = []

    rows = session.execute(
        text(
            "SELECT id, config_key, config_value "
            "FROM system_configs ORDER BY id"
        )
    ).mappings()

    for row in rows:
        ciphertext = row["config_value"]
        if ciphertext is None:
            continue

        encoded = ciphertext.encode() if isinstance(ciphertext, str) else ciphertext
        try:
            new_fernet.decrypt(encoded)
            continue
        except InvalidToken:
            pass

        try:
            plaintext = old_fernet.decrypt(encoded)
        except InvalidToken as exc:
            raise RuntimeError(
                f"Unable to decrypt system config {row['config_key']} with either Fernet key"
            ) from exc

        changed_keys.append(str(row["config_key"]))
        if not dry_run:
            session.execute(
                text(
                    "UPDATE system_configs SET config_value = :ciphertext "
                    "WHERE id = :id"
                ),
                {
                    "ciphertext": new_fernet.encrypt(plaintext).decode(),
                    "id": row["id"],
                },
            )

    return ReencryptResult(tuple(changed_keys))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Re-encrypt OMS system_configs from FERNET_KEY_OLD to FERNET_KEY"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report rows that would change without writing ciphertext",
    )
    args = parser.parse_args()

    old_key = os.getenv("FERNET_KEY_OLD")
    new_key = os.getenv("FERNET_KEY")
    _load_fernet(old_key, "FERNET_KEY_OLD")
    _load_fernet(new_key, "FERNET_KEY")

    # Import only after validating the key inputs; database.py imports the ORM
    # models, which construct the current-key encrypted column at import time.
    backend_dir = str(Path(__file__).resolve().parents[1])
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from database import SessionLocal

    with SessionLocal.begin() as session:
        result = reencrypt_system_configs(
            session,
            old_key,
            new_key,
            dry_run=args.dry_run,
        )

    action = "would re-encrypt" if args.dry_run else "re-encrypted"
    keys = ", ".join(result.changed_keys) if result.changed_keys else "none"
    print(f"{action} {result.changed_count} system_configs row(s): {keys}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
