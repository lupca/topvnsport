from sqlalchemy import and_, create_engine, event, inspect
from sqlalchemy.orm import Session, declarative_base, sessionmaker, with_loader_criteria
from core.config import DATABASE_URL
from utils.tenant_context import (
    get_tenant_context,
    is_maintenance_bypass,
    require_tenant_context,
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


@event.listens_for(Session, "do_orm_execute")
def add_tenant_criteria(execute_state):
    if not execute_state.is_select or is_maintenance_bypass():
        return

    # Import lazily to avoid the models -> database import cycle.
    from models import TenantSellerOwned

    context = get_tenant_context()
    if context is None:
        descriptions = getattr(execute_state.statement, "column_descriptions", ())
        touches_owned_model = any(
            isinstance(description.get("entity"), type)
            and issubclass(description["entity"], TenantSellerOwned)
            for description in descriptions
        )
        if not touches_owned_model:
            return
        context = require_tenant_context()

    tenant_id = context.tenant_id
    seller_id = context.seller_id
    execute_state.statement = execute_state.statement.options(
        with_loader_criteria(
            TenantSellerOwned,
            lambda model: and_(
                model.tenant_id == tenant_id,
                model.seller_id == seller_id,
            ),
            include_aliases=True,
        )
    )


@event.listens_for(Session, "before_flush")
def stamp_and_validate_tenant_ownership(session, _flush_context, _instances):
    if is_maintenance_bypass():
        return

    from models import (
        Channel,
        Customer,
        FulfillmentOrder,
        Order,
        OrderEvent,
        Payment,
        TenantSellerOwned,
    )

    owned_new = [obj for obj in session.new if isinstance(obj, TenantSellerOwned)]
    owned_dirty = [obj for obj in session.dirty if isinstance(obj, TenantSellerOwned)]
    owned_deleted = [
        obj for obj in session.deleted if isinstance(obj, TenantSellerOwned)
    ]
    if not owned_new and not owned_dirty and not owned_deleted:
        return

    context = require_tenant_context()
    for obj in owned_new:
        if obj.tenant_id is None:
            obj.tenant_id = context.tenant_id
        if obj.seller_id is None:
            obj.seller_id = context.seller_id
        if (obj.tenant_id, obj.seller_id) != (
            context.tenant_id,
            context.seller_id,
        ):
            raise ValueError("Cannot create an OMS row for another tenant or seller")

    def scoped_parent(model, parent_id):
        if parent_id is None:
            return None
        return (
            session.query(model)
            .filter(
                model.id == parent_id,
                model.tenant_id == context.tenant_id,
                model.seller_id == context.seller_id,
            )
            .first()
        )

    for obj in owned_new:
        if isinstance(obj, (FulfillmentOrder, OrderEvent, Payment)):
            parent = obj.order
            if parent is None and obj.order_id is not None:
                parent = scoped_parent(Order, obj.order_id)
            if parent is None or (obj.tenant_id, obj.seller_id) != (
                parent.tenant_id,
                parent.seller_id,
            ):
                raise ValueError("Child ownership must match its parent order")
        if isinstance(obj, Order):
            customer = obj.customer or scoped_parent(Customer, obj.customer_id)
            channel = obj.channel or scoped_parent(Channel, obj.channel_id)
            if customer is None or channel is None:
                raise ValueError(
                    "Order customer and channel must belong to the same seller"
                )
            if any(
                (parent.tenant_id, parent.seller_id)
                != (obj.tenant_id, obj.seller_id)
                for parent in (customer, channel)
            ):
                raise ValueError(
                    "Order customer and channel ownership must match the order"
                )

    for obj in owned_dirty:
        state = inspect(obj)
        if (
            state.attrs.tenant_id.history.has_changes()
            or state.attrs.seller_id.history.has_changes()
        ):
            raise ValueError("OMS row ownership is immutable")
        if (obj.tenant_id, obj.seller_id) != (
            context.tenant_id,
            context.seller_id,
        ):
            raise ValueError("Cannot update an OMS row for another tenant or seller")
        if isinstance(obj, Order) and (
            state.attrs.customer_id.history.has_changes()
            or state.attrs.channel_id.history.has_changes()
        ):
            if (
                scoped_parent(Customer, obj.customer_id) is None
                or scoped_parent(Channel, obj.channel_id) is None
            ):
                raise ValueError(
                    "Order customer and channel must belong to the same seller"
                )

    for obj in owned_deleted:
        if (obj.tenant_id, obj.seller_id) != (
            context.tenant_id,
            context.seller_id,
        ):
            raise ValueError("Cannot delete an OMS row for another tenant or seller")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
