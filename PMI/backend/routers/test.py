from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="/api/test", tags=["Test Utilities"])

@router.post("/reset-db")
def reset_db_for_testing(db: Session = Depends(get_db)):
    db.query(models.AuditLog).delete()
    db.query(models.AuditOutbox).delete()
    db.commit()
    return {"status": "success"}
