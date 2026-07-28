from enum import Enum
from typing import Callable, Dict, List, Optional, Any
import logging
from sqlalchemy.orm import Session

import models

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
                event_record = models.OrderEvent(
                    order_id=payload["order_id"],
                    event_type=event_name,
                    payload=payload,
                    created_by=created_by or payload.get("created_by") or "system",
                )
                db.add(event_record)
                db.commit()
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
