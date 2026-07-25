import os

DATABASE_URL: str | None = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")
ENV: str = os.getenv("ENV", "development")
CORS_ALLOWED_ORIGINS: str = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://topvnsport.com,http://www.topvnsport.com,http://pmi.topvnsport.com,http://oms.topvnsport.com,http://wms.topvnsport.com"
)
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    if ENV == "production":
        raise RuntimeError("JWT_SECRET_KEY environment variable is required in production mode!")
    JWT_SECRET_KEY = "wms-dev-only-jwt-key-not-for-production"
