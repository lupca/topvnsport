import sys, os
sys.path.append('/app')
from database import SessionLocal
from models import SystemConfig
db = SessionLocal()
config = db.query(SystemConfig).filter(SystemConfig.config_key == "speed_sms_token").first()
if not config:
    print("config is None")
else:
    print(f"config.config_value: '{config.config_value}'")
