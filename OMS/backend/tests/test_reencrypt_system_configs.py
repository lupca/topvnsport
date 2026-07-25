from cryptography.fernet import Fernet
from sqlalchemy import Column, Integer, MetaData, String, Table, Text, create_engine, text
from sqlalchemy.orm import sessionmaker

from scripts.reencrypt_system_configs import reencrypt_system_configs


def test_reencrypt_system_configs_is_idempotent():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    system_configs = Table(
        "system_configs",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("config_key", String(100), nullable=False),
        Column("config_value", Text),
    )
    metadata.create_all(engine)

    old_key = Fernet.generate_key().decode()
    new_key = Fernet.generate_key().decode()
    old_fernet = Fernet(old_key.encode())
    new_fernet = Fernet(new_key.encode())
    Session = sessionmaker(bind=engine)

    with Session.begin() as session:
        session.execute(
            system_configs.insert(),
            {
                "config_key": "zalo_access_token",
                "config_value": old_fernet.encrypt(b"token-value").decode(),
            },
        )

    with Session.begin() as session:
        result = reencrypt_system_configs(session, old_key, new_key)
        assert result.changed_keys == ("zalo_access_token",)

    with engine.connect() as connection:
        ciphertext = connection.execute(
            text("SELECT config_value FROM system_configs WHERE config_key = 'zalo_access_token'")
        ).scalar_one()
    assert new_fernet.decrypt(ciphertext.encode()) == b"token-value"

    with Session.begin() as session:
        result = reencrypt_system_configs(session, old_key, new_key)
        assert result.changed_keys == ()
