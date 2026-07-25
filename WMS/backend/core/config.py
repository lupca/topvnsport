import os

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@database-topvnsport.cluster-copm008y8icu.us-east-1.rds.amazonaws.com:5432/wms"
)
ENV: str = os.getenv("ENV", "development")
CORS_ALLOWED_ORIGINS: str = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://topvnsport.com,http://www.topvnsport.com,http://pmi.topvnsport.com,http://oms.topvnsport.com,http://wms.topvnsport.com"
)
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "identity_jwt_secret_key_2026_change_me_in_prod")
