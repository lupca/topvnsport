from datetime import datetime, timedelta, timezone
from typing import Optional
import logging
from sqlalchemy.orm import Session

from adapters.channels.shopee import ShopeeAdapter
from adapters.channels.tiktok import TikTokAdapter
from adapters.channels.lazada import LazadaAdapter
from adapters.channels.web import WebAdapter
from services.order_service import OrderService

logger = logging.getLogger("oms_backend")


def get_active_channel_adapters():
    return [
        ShopeeAdapter(),
        TikTokAdapter(),
        LazadaAdapter(),
        WebAdapter(),
    ]


async def sync_channel_orders(
    db: Session,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
) -> int:
    """Worker poll đơn hàng mới từ các kênh bán hàng"""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    to_dt = to_date or now
    from_dt = from_date or (to_dt - timedelta(minutes=15))

    total_synced = 0
    adapters = get_active_channel_adapters()

    for adapter in adapters:
        try:
            logger.info(f"Syncing channel [{adapter.channel_code}] orders...")
            orders = await adapter.fetch_orders(from_date=from_dt, to_date=to_dt)
            for order in orders:
                await OrderService.create_or_ingest_order(db, order, created_by=f"worker_sync_{adapter.channel_code}")
                total_synced += 1
        except Exception as e:
            logger.error(f"Channel sync failed for {adapter.channel_code}: {e}")

    logger.info(f"Channel order sync completed. Total orders ingested: {total_synced}")
    return total_synced
