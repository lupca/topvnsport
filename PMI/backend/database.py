import os
from sqlalchemy import and_, create_engine, event, select
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Query, Session, sessionmaker, with_loader_criteria

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/pim_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)

Base = declarative_base()


@event.listens_for(Query, "before_compile", retval=True, bake_ok=True)
def _scope_legacy_query(query):
    """Scope legacy Query objects before count/update/delete wrap the ORM SELECT."""
    from utils.context import require_tenant_context, tenant_context_active_var

    if not tenant_context_active_var.get():
        return query
    if query._execution_options.get("tenant_scope_bypass"):
        return query
    if query.session is not None and query.session.info.get("tenant_scope_bypass"):
        return query

    context = require_tenant_context()
    entities = {
        description.get("entity")
        for description in query.column_descriptions
        if description.get("entity") is not None
    }
    for entity in entities:
        if hasattr(entity, "tenant_id") and hasattr(entity, "seller_id"):
            query = query.enable_assertions(False).filter(
                entity.tenant_id == context.tenant_id,
                entity.seller_id == context.seller_id,
            )
    return query

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@event.listens_for(Session, "do_orm_execute")
def _apply_tenant_seller_criteria(execute_state):
    """Apply ownership predicates to every ORM read and ORM bulk mutation."""
    if execute_state.execution_options.get("tenant_scope_bypass"):
        return

    from utils.context import require_tenant_context, tenant_context_active_var

    if not tenant_context_active_var.get():
        return

    context = require_tenant_context()
    tenant_id = context.tenant_id
    seller_id = context.seller_id
    owned_models = tuple(
        mapper.class_
        for mapper in execute_state.all_mappers
        if hasattr(mapper.class_, "tenant_id") and hasattr(mapper.class_, "seller_id")
    )
    if not owned_models:
        return
    execute_state.statement = execute_state.statement.options(
        *(
            with_loader_criteria(
                model,
                lambda owned: and_(
                    owned.tenant_id == tenant_id,
                    owned.seller_id == seller_id,
                ),
                include_aliases=True,
            )
            for model in owned_models
        )
    )


@event.listens_for(Session, "before_flush")
def _stamp_and_guard_tenant_seller_rows(session, flush_context, instances):
    """Stamp inserts and reject cross-context ORM updates/deletes."""
    from utils.context import require_tenant_context, tenant_context_active_var

    if session.info.get("tenant_scope_bypass") or not tenant_context_active_var.get():
        return

    context = require_tenant_context()
    for row in session.new:
        if not hasattr(row, "tenant_id") or not hasattr(row, "seller_id"):
            continue
        if row.tenant_id not in (None, context.tenant_id) or row.seller_id not in (
            None,
            context.seller_id,
        ):
            raise ValueError("Cannot insert a row owned by another tenant or seller")
        row.tenant_id = context.tenant_id
        row.seller_id = context.seller_id

    parent_specs = {
        "categories": ("parent_id", "categories"),
        "products": ("category_id", "categories"),
        "product_variants": ("product_id", "products"),
        "promotion_scope": ("promotion_id", "promotions"),
        "promotion_computed_prices": ("promotion_id", "promotions"),
        "promotion_usage_log": ("promotion_id", "promotions"),
    }
    for row in session.new.union(session.dirty):
        spec = parent_specs.get(getattr(getattr(row, "__table__", None), "name", None))
        if spec is None:
            continue
        foreign_key_name, parent_table_name = spec
        foreign_key_value = getattr(row, foreign_key_name, None)
        if foreign_key_value is None:
            continue

        pending_parent = next(
            (
                candidate
                for candidate in session.new
                if getattr(getattr(candidate, "__table__", None), "name", None)
                == parent_table_name
                and str(getattr(candidate, "id", None)) == str(foreign_key_value)
            ),
            None,
        )
        if pending_parent is not None:
            parent_matches = (
                pending_parent.tenant_id == context.tenant_id
                and pending_parent.seller_id == context.seller_id
            )
        else:
            parent_table = row.__table__.metadata.tables[parent_table_name]
            parent_matches = session.connection().execute(
                select(parent_table.c.id).where(
                    parent_table.c.id == foreign_key_value,
                    parent_table.c.tenant_id == context.tenant_id,
                    parent_table.c.seller_id == context.seller_id,
                )
            ).first() is not None
        if not parent_matches:
            raise ValueError(
                f"{row.__table__.name}.{foreign_key_name} belongs to another seller"
            )

    for row in session.dirty.union(session.deleted):
        if not hasattr(row, "tenant_id") or not hasattr(row, "seller_id"):
            continue
        if row.tenant_id != context.tenant_id or row.seller_id != context.seller_id:
            raise ValueError("Cannot mutate a row owned by another tenant or seller")
