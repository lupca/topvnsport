"""Helpers for per-seller external API keys (``vk_<env>_<random>``).

Keys are random secrets shown to the admin exactly once. Only the SHA-256 hash
is persisted. The ``vk_`` namespace is reserved for these external keys so they
can never be confused with the internal service-to-service token
(``INTERNAL_SERVICE_TOKEN``), which services refuse to start with if it uses
the same prefix.
"""
import hashlib
import os
import re
import secrets
from typing import Iterable, Optional
from urllib.parse import urlsplit

API_KEY_NAMESPACE = "vk_"
API_KEY_ENVS = ("live", "test")
# 32 random bytes -> 43 urlsafe characters (contract requires >= 32).
_RANDOM_BYTES = 32
API_KEY_PATTERN = re.compile(r"^vk_(live|test)_[A-Za-z0-9_-]{32,128}$")
# Number of random characters (after ``vk_<env>_``) kept in ``prefix``.
PREFIX_RANDOM_CHARS = 8

SCOPE_INSIGHTS_READ = "insights:read"
SCOPE_INBOUND_WRITE = "inbound:write"

# Contract §2: the only (method, gateway path) pairs an API key may call.
API_KEY_ROUTE_RULES: dict[str, frozenset[tuple[str, str]]] = {
    SCOPE_INSIGHTS_READ: frozenset(
        {
            ("GET", "/api/pmi/products"),
            ("GET", "/api/oms/orders"),
            ("GET", "/api/wms/inbound-shipments"),
        }
    ),
    SCOPE_INBOUND_WRITE: frozenset(
        {
            ("POST", "/api/wms/inbound-shipments"),
        }
    ),
}
VALID_SCOPES = tuple(API_KEY_ROUTE_RULES.keys())


def api_key_env() -> str:
    """Environment tag embedded in newly generated keys."""
    configured = os.getenv("API_KEY_ENV", "").strip().lower()
    if configured:
        if configured not in API_KEY_ENVS:
            raise RuntimeError(
                f"API_KEY_ENV must be one of {', '.join(API_KEY_ENVS)}"
            )
        return configured
    return "live" if os.getenv("ENV") == "production" else "test"


def generate_api_key(env: Optional[str] = None) -> str:
    env = env or api_key_env()
    return f"{API_KEY_NAMESPACE}{env}_{secrets.token_urlsafe(_RANDOM_BYTES)}"


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def key_prefix(raw_key: str) -> str:
    """``vk_<env>_`` plus the first 8 random characters, for display only."""
    namespace, env, rest = raw_key.split("_", 2)
    return f"{namespace}_{env}_{rest[:PREFIX_RANDOM_CHARS]}"


def looks_like_api_key(value: Optional[str]) -> bool:
    return bool(value) and value.startswith(API_KEY_NAMESPACE)


def is_well_formed(raw_key: str) -> bool:
    return bool(API_KEY_PATTERN.fullmatch(raw_key))


def normalize_scopes(scopes: Iterable[str]) -> list[str]:
    """Deduplicate while keeping the canonical order of ``VALID_SCOPES``."""
    requested = set(scopes)
    unknown = requested - set(VALID_SCOPES)
    if unknown:
        raise ValueError(f"Phạm vi quyền không hợp lệ: {', '.join(sorted(unknown))}")
    return [scope for scope in VALID_SCOPES if scope in requested]


def canonical_path(original_uri: Optional[str]) -> Optional[str]:
    """Return the raw request path (no query) with one trailing slash removed.

    The path is deliberately *not* decoded or normalised: matching is exact,
    so encoded or dot-segment variants fail closed (403) instead of being
    resolved differently by Identity and nginx.
    """
    if not original_uri:
        return None
    path = urlsplit(original_uri).path
    if not path.startswith("/"):
        return None
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    return path


def route_scope(method: Optional[str], path: Optional[str]) -> Optional[set[str]]:
    """Scopes that grant ``method path``; ``None`` if no scope ever allows it."""
    if not method or not path:
        return None
    pair = (method.upper(), path)
    granting = {scope for scope, rules in API_KEY_ROUTE_RULES.items() if pair in rules}
    return granting or None
