import os

DATABASE_URL: str | None = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")
ENV: str = os.getenv("ENV", "development")
CORS_ALLOWED_ORIGINS: str = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "https://voma.vn,https://www.voma.vn,https://pim.voma.vn,https://oms.voma.vn,https://wms.voma.vn,https://identity.voma.vn"
)
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    if ENV == "production":
        raise RuntimeError("JWT_SECRET_KEY environment variable is required in production mode!")
    JWT_SECRET_KEY = "wms-dev-only-jwt-key-not-for-production"
