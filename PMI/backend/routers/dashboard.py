from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import datetime

router = APIRouter(prefix='/dashboard', tags=['Dashboard'])

@router.get("/stats", response_model=schemas.DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        # 1. Standard counts
        total_products = db.query(models.Product).count()
        active_products = db.query(models.Product).filter(models.Product.status == "Published").count()
        inactive_products = db.query(models.Product).filter(models.Product.status != "Published").count()
        
        total_categories = db.query(models.Category).count()
        total_attributes = db.query(models.Attribute).count()
        total_groups = db.query(models.AttributeGroup).count()
        total_families = db.query(models.AttributeFamily).count()
        total_locales = db.query(models.Locale).count()
        total_currencies = db.query(models.Currency).count()
        total_channels = db.query(models.Channel).count()

        # 2. Completeness rate
        products = db.query(models.Product).all()
        if not products:
            completeness_rate = 0.0
        else:
            total_score = 0.0
            for p in products:
                score = 0
                if p.description and p.description.strip():
                    score += 25
                if p.media:
                    score += 25
                if p.weight and p.weight > 0:
                    score += 25
                if p.variants:
                    score += 25
                total_score += score
            completeness_rate = round(total_score / len(products), 2)

        # 3. Activity data (last 7 days)
        today = datetime.date.today()
        activity_data = []
        for i in range(6, -1, -1):
            day = today - datetime.timedelta(days=i)
            day_str = day.strftime("%Y-%m-%d")
            
            # Count products registered on this day
            start_datetime = datetime.datetime.combine(day, datetime.time.min)
            end_datetime = datetime.datetime.combine(day, datetime.time.max)
            count = db.query(models.Product).filter(
                models.Product.created_at >= start_datetime,
                models.Product.created_at <= end_datetime
            ).count()
            
            activity_data.append({
                "date": day_str,
                "count": count
            })

        return {
            "total_products": total_products,
            "active_products": active_products,
            "inactive_products": inactive_products,
            "total_categories": total_categories,
            "total_attributes": total_attributes,
            "total_groups": total_groups,
            "total_families": total_families,
            "total_locales": total_locales,
            "total_currencies": total_currencies,
            "total_channels": total_channels,
            "completeness_rate": completeness_rate,
            "activity_data": activity_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dashboard stats: {str(e)}")

