from datetime import timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session

import models
from database import get_db
from utils.api_utils import utcnow
from utils.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order_count = db.query(models.Order).count()
    customer_count = db.query(models.Customer).count()
    
    revenue_query = db.query(func.sum(models.Order.total_amount)).filter(models.Order.status != "CANCELLED").scalar()
    revenue = float(revenue_query) if revenue_query is not None else 0.0
    
    status_counts_query = db.query(models.Order.status, func.count(models.Order.id)).group_by(models.Order.status).all()
    status_counts = {status: count for status, count in status_counts_query}
    
    # 7-day daily activity stats (last 7 days ordered oldest to newest)
    daily_stats = []
    for i in range(6, -1, -1):
        d = utcnow() - timedelta(days=i)
        target_date = d.date()
        date_str = target_date.strftime("%Y-%m-%d")
        
        day_query = db.query(
            func.count(models.Order.id),
            func.sum(models.Order.total_amount)
        ).filter(
            cast(models.Order.created_at, Date) == target_date,
            models.Order.status != "CANCELLED"
        ).first()
        
        count = day_query[0] or 0
        rev = float(day_query[1]) if day_query[1] is not None else 0.0
        
        daily_stats.append({
            "date": date_str,
            "count": count,
            "revenue": rev
        })
        
    return {
        "order_count": order_count,
        "revenue": revenue,
        "customer_count": customer_count,
        "status_counts": status_counts,
        "daily_stats": daily_stats
    }
