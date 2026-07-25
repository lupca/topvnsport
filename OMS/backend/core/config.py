import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@database-topvnsport.cluster-copm008y8icu.us-east-1.rds.amazonaws.com:5432/oms"
)
ENV = os.getenv("ENV", "development")
