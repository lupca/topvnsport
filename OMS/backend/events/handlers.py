import logging
from events.dispatcher import EventDispatcher, OrderEvent

logger = logging.getLogger("oms_backend")


@EventDispatcher.register(OrderEvent.CREATED)
async def handle_order_created(payload: dict):
    logger.info(f"Handler [OrderEvent.CREATED]: Order {payload.get('order_id')} created from channel {payload.get('channel_code')}")


@EventDispatcher.register(OrderEvent.PAID)
async def handle_order_paid(payload: dict):
    logger.info(f"Handler [OrderEvent.PAID]: Order {payload.get('order_id')} paid via {payload.get('payment_method')}")


@EventDispatcher.register(OrderEvent.COMPLETED)
async def handle_order_completed(payload: dict):
    logger.info(f"Handler [OrderEvent.COMPLETED]: Order {payload.get('order_id')} completed. Queueing invoice generation.")


@EventDispatcher.register(OrderEvent.CANCELLED)
async def handle_order_cancelled(payload: dict):
    logger.info(f"Handler [OrderEvent.CANCELLED]: Order {payload.get('order_id')} cancelled.")
