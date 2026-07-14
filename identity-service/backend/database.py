import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Fallback to local development PostgreSQL database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@identity-db:5432/identity_db")

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Proactively test connections before executing checkouts
    pool_size=10,        # Default pool size
    max_overflow=20,     # Max overflow connections beyond pool size
    echo=os.getenv("SQL_ECHO", "false").lower() == "true", # Conditional log SQL queries
)

# Configured sessionmaker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for declarative models
Base = declarative_base()

# FastAPI dependency to obtain a database session per-request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
