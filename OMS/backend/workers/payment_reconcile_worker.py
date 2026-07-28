from datetime import datetime, date, timedelta, timezone
from typing import Optional, Dict, Any
import logging
from sqlalchemy.orm import Session

from services.reconciliation_service import ReconciliationService

logger = logging.getLogger("oms_backend")


async def daily_reconciliation(
    db: Session,
    target_date: Optional[date] = None,
) -> Dict[str, Any]:
    """Worker đối soát thanh toán hàng ngày"""
    t_date = target_date or (date.today() - timedelta(days=1))
    from_dt = datetime.combine(t_date, datetime.min.time())
    to_dt = datetime.combine(t_date, datetime.max.time())

    logger.info(f"Starting daily reconciliation worker for date {t_date}")
    report = await ReconciliationService.reconcile_payments(db, from_date=from_dt, to_date=to_dt)
    logger.info(f"Daily reconciliation report: {report}")
    return report
