from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

# Append OMS backend path
sys.path.append(os.path.join(os.getcwd(), 'OMS/backend'))
from models import SmsRateLimit

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:15434/oms_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

db = SessionLocal()
db.query(SmsRateLimit).filter(SmsRateLimit.phone_number == "84382426669").delete()
db.commit()
db.close()
print("Rate limit cleared.")
