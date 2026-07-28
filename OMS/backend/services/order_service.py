from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any
import logging
from sqlalchemy.orm import Session

import models
from adapters.channels.base import NormalizedOrder
from events.dispatcher import EventDispatcher, OrderEvent

logger = logging.getLogger("oms_backend")


class OrderService:

    @staticmethod
    async def create_or_ingest_order(
        db: Session,
        normalized_order: NormalizedOrder,
        created_by: str = "channel_sync",
    ) -> models.Order:
        """Tạo hoặc cập nhật đơn hàng được chuẩn hóa từ mọi kênh"""
        # Search existing order by channel_code + channel_order_id
        existing_order = (
            db.query(models.Order)
            .filter(
                models.Order.channel_code == normalized_order.channel_code,
                models.Order.channel_order_id == normalized_order.channel_order_id,
            )
            .first()
        )
        if existing_order:
            logger.info(
                f"Order already exists for channel {normalized_order.channel_code} ID {normalized_order.channel_order_id}"
            )
            return existing_order

        # Customer lookup/creation by phone
        customer = (
            db.query(models.Customer)
            .filter(models.Customer.phone == normalized_order.customer_phone)
            .first()
        )
        if not customer:
            customer = models.Customer(
                name=normalized_order.customer_name,
                phone=normalized_order.customer_phone,
                email=normalized_order.customer_email,
                address=normalized_order.shipping_address,
            )
            db.add(customer)
            db.flush()

        # Channel ID lookup
        channel = (
            db.query(models.Channel)
            .filter(models.Channel.code == normalized_order.channel_code)
            .first()
        )
        channel_id = channel.id if channel else 1

        order_number = f"ORD-{normalized_order.channel_code}-{normalized_order.channel_order_id}"

        order = models.Order(
            order_number=order_number,
            customer_id=customer.id,
            channel_id=channel_id,
            channel_code=normalized_order.channel_code,
            channel_order_id=normalized_order.channel_order_id,
            channel_metadata=normalized_order.channel_metadata,
            status="DRAFT",
            total_amount=normalized_order.total_amount,
            shipping_fee=normalized_order.shipping_fee,
            shipping_address=normalized_order.shipping_address,
            payment_status="PENDING",
            created_by=created_by,
        )
        db.add(order)
        db.flush()

        for item_data in normalized_order.items:
            unit_price = Decimal(str(item_data.get("unit_price", 0)))
            quantity = int(item_data.get("quantity", 1))
            subtotal = Decimal(str(item_data.get("subtotal", unit_price * quantity)))
            order_item = models.OrderItem(
                order_id=order.id,
                sku_code=item_data.get("sku_code", "UNKNOWN-SKU"),
                product_name=item_data.get("product_name", "Product"),
                variant_name=item_data.get("variant_name"),
                quantity=quantity,
                unit_price=unit_price,
                subtotal=subtotal,
                image_url=item_data.get("image_url"),
            )
            db.add(order_item)

        db.commit()
        db.refresh(order)

        await EventDispatcher.dispatch(
            OrderEvent.CREATED,
            {
                "order_id": order.id,
                "order_number": order.order_number,
                "channel_code": order.channel_code,
                "total_amount": float(order.total_amount),
            },
            db=db,
            created_by=created_by,
        )

        return order

    @staticmethod
    async def update_order_status(
        db: Session,
        order_id: int,
        new_status: str,
        created_by: str = "system",
    ) -> models.Order:
        order = db.query(models.Order).filter(models.Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        old_status = order.status
        order.status = new_status
        db.commit()
        db.refresh(order)

        event_mapping = {
            "CONFIRMED": OrderEvent.CONFIRMED,
            "PAID": OrderEvent.PAID,
            "SHIPPED": OrderEvent.SHIPPED,
            "COMPLETED": OrderEvent.COMPLETED,
            "CANCELLED": OrderEvent.CANCELLED,
        }
        if new_status in event_mapping:
            await EventDispatcher.dispatch(
                event_mapping[new_status],
                {
                    "order_id": order.id,
                    "order_number": order.order_number,
                    "old_status": old_status,
                    "new_status": new_status,
                },
                db=db,
                created_by=created_by,
            )

        return order
