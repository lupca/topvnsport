from enum import Enum
from typing import Callable, Dict, List, Optional, Any
import logging
from sqlalchemy.orm import Session

import models
from utils.tenant_context import require_tenant_context

logger = logging.getLogger("oms_backend")


class OrderEvent(Enum):
    CREATED = "order.created"
    CONFIRMED = "order.confirmed"
    PAID = "order.paid"
    SHIPPED = "order.shipped"
    COMPLETED = "order.completed"
    CANCELLED = "order.cancelled"


class EventDispatcher:
    _handlers: Dict[str, List[Callable]] = {}

    @classmethod
    def register(cls, event: OrderEvent):
        """Decorator để đăng ký handler cho event"""
        def decorator(handler: Callable):
            event_name = event.value
            if event_name not in cls._handlers:
                cls._handlers[event_name] = []
            cls._handlers[event_name].append(handler)
            return handler
        return decorator

    @classmethod
    async def dispatch(
        cls,
        event: OrderEvent,
        payload: Dict[str, Any],
        db: Optional[Session] = None,
        created_by: Optional[str] = None,
    ):
        """Dispatch event tới tất cả handlers registered và ghi audit trail vào order_events"""
        event_name = event.value
        logger.info(f"Dispatching event [{event_name}] with payload: {payload}")

        if db and "order_id" in payload:
            try:
                context = require_tenant_context()
                payload_context = (
                    payload.get("tenant_id"),
                    payload.get("seller_id"),
                )
                expected_context = (
                    str(context.tenant_id),
                    str(context.seller_id),
                )
                if payload_context != (None, None) and payload_context != expected_context:
                    raise ValueError("Event ownership does not match request context")
                payload = {
                    **payload,
                    "tenant_id": expected_context[0],
                    "seller_id": expected_context[1],
                }
                order = (
                    db.query(models.Order)
                    .filter(models.Order.id == payload["order_id"])
                    .first()
                )
                if order is None:
                    raise ValueError("Event parent order is outside the current scope")
                event_record = models.OrderEvent(
                    tenant_id=context.tenant_id,
                    seller_id=context.seller_id,
                    order_id=payload["order_id"],
                    order=order,
                    event_type=event_name,
                    payload=payload,
                    created_by=created_by or payload.get("created_by") or "system",
                )
                db.add(event_record)
                db.commit()
            except ValueError:
                db.rollback()
                raise
            except Exception as e:
                logger.error(f"Failed to record audit trail for event {event_name}: {e}")
                db.rollback()

        handlers = cls._handlers.get(event_name, [])
        for handler in handlers:
            try:
                res = handler(payload)
                if hasattr(res, "__await__"):
                    await res
            except Exception as e:
                logger.error(f"Error executing handler {handler.__name__} for {event_name}: {e}")
