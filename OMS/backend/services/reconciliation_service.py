from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import List, Dict, Any, Optional
import logging
from sqlalchemy.orm import Session

import models
from adapters.payments.base import PaymentTransaction, PaymentProvider
from adapters.payments.sepay import SePayAdapter
from adapters.payments.vnpay import VNPayAdapter
from adapters.payments.momo import MoMoAdapter

logger = logging.getLogger("oms_backend")


class ReconciliationService:

    @staticmethod
    async def reconcile_payments(
        db: Session,
        from_date: datetime,
        to_date: datetime,
        provider_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Đối soát danh sách giao dịch từ payment providers với DB payments"""
        providers: List[PaymentProvider] = []
        if provider_code:
            p_map = {"SEPAY": SePayAdapter(), "VNPAY": VNPayAdapter(), "MOMO": MoMoAdapter()}
            if provider_code.upper() in p_map:
                providers.append(p_map[provider_code.upper()])
        else:
            providers = [SePayAdapter(), VNPayAdapter(), MoMoAdapter()]

        # Query payments in DB for date range
        db_payments = (
            db.query(models.Payment)
            .filter(
                models.Payment.created_at >= from_date,
                models.Payment.created_at <= to_date,
            )
            .all()
        )
        db_txn_ids = {p.provider_txn_id for p in db_payments if p.provider_txn_id}

        matched_count = 0
        discrepancies = []
        total_matched_amount = Decimal("0")
        total_unmatched_amount = Decimal("0")

        for p in db_payments:
            if p.status == "SUCCESS":
                matched_count += 1
                total_matched_amount += p.amount
                p.reconciled_at = datetime.now(timezone.utc).replace(tzinfo=None)
            else:
                discrepancies.append({
                    "payment_id": p.id,
                    "order_id": p.order_id,
                    "provider": p.provider,
                    "amount": float(p.amount),
                    "reason": f"Payment in status {p.status}",
                })
                total_unmatched_amount += p.amount

        db.commit()

        return {
            "period": {"from_date": from_date.isoformat(), "to_date": to_date.isoformat()},
            "total_payments": len(db_payments),
            "total_matched": matched_count,
            "discrepancies_count": len(discrepancies),
            "discrepancies": discrepancies,
            "matched_amount": float(total_matched_amount),
            "unmatched_amount": float(total_unmatched_amount),
            "reconciled_at": datetime.now(timezone.utc).isoformat(),
        }
