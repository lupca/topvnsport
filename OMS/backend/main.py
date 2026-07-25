import os
import asyncio
import inspect
import logging
import threading
from contextlib import asynccontextmanager
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
import models
import services.zalo_service
from database import SessionLocal
from utils.api_utils import (
    PIM_API_URL,
    WMS_API_URL,
    DEFAULT_FULFILLMENT_WAREHOUSE_CODE,
    PIM_API_KEY,
    utcnow,
    call_api,
    validation_exception_handler,
)
from services.inventory_service import allocate_order_items, _fetch_inventory_snapshot
from routers.otp import LAST_OTPS
from routers import (
    otp,
    orders,
    fulfillment,
    customers,
    channels,
    dashboard,
    config,
    webhooks,
    products,
)

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("oms_backend")

# Seed initial channels data
db_seed = SessionLocal()
try:
    channels_to_seed = [
        ("MANUAL", "Manual"),
        ("STOREFRONT", "Storefront"),
        ("SHOPEE", "Shopee"),
        ("TIKTOK_SHOP", "TikTok Shop"),
        ("LAZADA", "Lazada"),
    ]
    for code, name in channels_to_seed:
        existing_channel = db_seed.query(models.Channel).filter(models.Channel.code == code).first()
        if not existing_channel:
            db_seed.add(models.Channel(code=code, name=name, is_active=True))
    db_seed.commit()
    logger.info("Successfully seeded initial channels data.")
except Exception as e:
    logger.error(f"Error seeding channels data: {e}")
    db_seed.rollback()
finally:
    db_seed.close()


_zalo_refresh_lock = threading.Lock()
zalo_token_scheduler: Optional[BackgroundScheduler] = None


def refresh_zalo_tokens_job() -> None:
    """Refresh and atomically persist the rotated Zalo OA token pair."""
    if not _zalo_refresh_lock.acquire(blocking=False):
        logger.info("Skipping overlapping Zalo token refresh.")
        return

    db = SessionLocal()
    try:
        configs = {
            config.config_key: config
            for config in db.query(models.SystemConfig).filter(
                models.SystemConfig.config_key.in_(
                    [
                        "zalo_access_token",
                        "zalo_refresh_token",
                        "zalo_app_id",
                        "zalo_app_secret",
                        "zalo_secret_key",
                    ]
                )
            )
        }
        app_id_config = configs.get("zalo_app_id")
        secret_config = configs.get("zalo_secret_key") or configs.get("zalo_app_secret")
        refresh_config = configs.get("zalo_refresh_token")

        if not all(
            config and config.config_value
            for config in (app_id_config, secret_config, refresh_config)
        ):
            logger.warning("Zalo token refresh skipped because its configuration is incomplete.")
            return

        refresh_result = services.zalo_service.refresh_zalo_token(
            app_id_config.config_value,
            secret_config.config_value,
            refresh_config.config_value,
        )
        result = (
            asyncio.run(refresh_result)
            if inspect.isawaitable(refresh_result)
            else refresh_result
        )
        if (
            result.get("status") != "success"
            or not result.get("access_token")
            or not result.get("refresh_token")
        ):
            logger.error("Zalo token refresh failed: %s", result.get("failed_reason"))
            return

        access_config = configs.get("zalo_access_token")
        if access_config is None:
            access_config = models.SystemConfig(
                config_key="zalo_access_token",
                description="Zalo OA Access Token",
            )
            db.add(access_config)

        access_config.config_value = result["access_token"]
        refresh_config.config_value = result["refresh_token"]
        db.commit()
        logger.info("Zalo OA tokens refreshed successfully.")
    except Exception:
        db.rollback()
        logger.exception("Unexpected error while refreshing Zalo OA tokens.")
    finally:
        db.close()
        _zalo_refresh_lock.release()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global zalo_token_scheduler
    if not (zalo_token_scheduler and zalo_token_scheduler.running):
        zalo_token_scheduler = BackgroundScheduler()
        zalo_token_scheduler.add_job(
            refresh_zalo_tokens_job,
            trigger="interval",
            hours=20,
            id="zalo_token_refresh",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        zalo_token_scheduler.start()
    yield
    if zalo_token_scheduler and zalo_token_scheduler.running:
        zalo_token_scheduler.shutdown(wait=False)
    zalo_token_scheduler = None


app = FastAPI(title="OMS Backend API", version="1.0.0", lifespan=lifespan)

# CORS Middleware
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "https://oms.topvnsport.com,http://localhost:13101,http://localhost:3000,http://127.0.0.1:13101",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(RequestValidationError, validation_exception_handler)

# Include Routers
app.include_router(otp.router)
app.include_router(webhooks.router)
app.include_router(config.router)
app.include_router(orders.router)
app.include_router(fulfillment.router)
app.include_router(customers.router)
app.include_router(channels.router)
app.include_router(dashboard.router)
app.include_router(products.router)


@app.get("/")
def read_root():
    return {"status": "ok", "service": "oms-backend"}
