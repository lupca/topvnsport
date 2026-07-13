import uuid
import inspect
from functools import wraps
from sqlalchemy.orm import Session
from fastapi import Request
from fastapi.responses import StreamingResponse
from database import SessionLocal
import models
from models import AuditOutbox, ActorType
from utils import context
from sqlalchemy import event

def record_audit_event(
    db_session: Session,
    module: str,
    action_type: str,
    entity_type: str = None,
    entity_id: str = None,
    changes: dict = None,
    raw_details: str = None,
    method: str = None,
    path: str = None
) -> models.AuditOutbox:
    """
    Fetches context variable values from utils/context.py and writes an AuditOutbox entry.
    Do NOT call db_session.commit() inside this function.
    """
    actor_id = context.get_actor_id()
    actor_username = context.get_actor_username()
    actor_type_str = context.get_actor_type()
    ip_address = context.get_ip_address()
    corr_id_str = context.get_correlation_id()

    # Handle correlation_id
    correlation_id = corr_id_str
    if not correlation_id:
        correlation_id = str(uuid.uuid4())

    # Map actor_type string to ActorType enum
    actor_type = ActorType.GUEST
    if actor_type_str:
        try:
            actor_type = ActorType(actor_type_str.upper())
        except ValueError:
            pass

    # Instantiate AuditOutbox
    record = AuditOutbox(
        correlation_id=correlation_id,
        actor_id=actor_id,
        actor_username=actor_username or "guest",
        actor_type=actor_type,
        ip_address=ip_address,
        method=method,
        path=path,
        module=module,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        changes=changes,
        raw_details=raw_details,
    )
    db_session.add(record)
    context.audit_logged_var.set(True)
    return record


def audit_action(module: str, action_type: str, read_only: bool = False):
    """
    FastAPI endpoint decorator that logs actions to AuditOutbox.
    """
    def decorator(func):
        sig = inspect.signature(func)
        
        # Determine the name of the Session parameter in the wrapped function
        db_param_name = None
        for param_name, param in sig.parameters.items():
            if param.annotation is Session or param_name == "db":
                db_param_name = param_name
                break

        def scan_arguments(args, kwargs):
            # Scan for db session
            db = None
            for name, val in kwargs.items():
                if isinstance(val, Session):
                    db = val
                    break
            if db is None:
                for arg in args:
                    if isinstance(arg, Session):
                        db = arg
                        break

            # Scan for Request object
            request = None
            for name, val in kwargs.items():
                if isinstance(val, Request):
                    request = val
                    break
            if request is None:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break

            # Scan for entity_id
            entity_id = None
            entity_keys = ["product_id", "category_id", "channel_id", "id"]
            for key in entity_keys:
                if key in kwargs:
                    entity_id = kwargs[key]
                    break
            if entity_id is None:
                param_names = list(sig.parameters.keys())
                for idx, arg in enumerate(args):
                    if idx < len(param_names):
                        name = param_names[idx]
                        if name in entity_keys:
                            entity_id = arg
                            break

            return db, request, entity_id



        if inspect.iscoroutinefunction(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                db, request, entity_id = scan_arguments(args, kwargs)
                own_session = False
                if db is None:
                    db = SessionLocal()
                    own_session = True
                    if db_param_name:
                        kwargs[db_param_name] = db

                method = request.method if request else None
                path = request.url.path if request else None

                context.audit_logged_var.set(False)
                audit_record_created = False

                def receive_before_commit(session):
                    nonlocal audit_record_created
                    if not audit_record_created and not context.audit_logged_var.get():
                        entity_id_val = entity_id
                        if entity_id_val is None:
                            for obj in session.new:
                                if obj.__class__.__name__.lower() == module.lower():
                                    session.flush()
                                    entity_id_val = getattr(obj, "id", None)
                                    break
                            if entity_id_val is None:
                                for obj in session.identity_map.values():
                                    if obj.__class__.__name__.lower() == module.lower():
                                        entity_id_val = getattr(obj, "id", None)
                                        break

                        entity_type = None
                        if module.lower() == "product":
                            entity_type = "Product"
                        elif module.lower() == "category":
                            entity_type = "Category"
                        elif module.lower() == "channel":
                            entity_type = "Channel"

                        record_audit_event(
                            db_session=session,
                            module=module,
                            action_type=action_type,
                            entity_type=entity_type,
                            entity_id=entity_id_val,
                            method=method,
                            path=path
                        )
                        audit_record_created = True

                try:
                    event.listen(db, "before_commit", receive_before_commit)
                    result = await func(*args, **kwargs)
                    
                    if not context.audit_logged_var.get():
                        # Extract entity_id from result if not found in args/kwargs
                        entity_id_val = entity_id
                        if entity_id_val is None and result is not None:
                            if hasattr(result, "id"):
                                entity_id_val = result.id
                            elif isinstance(result, dict) and "id" in result:
                                entity_id_val = result["id"]

                        entity_type = None
                        if module.lower() == "product":
                            entity_type = "Product"
                        elif module.lower() == "category":
                            entity_type = "Category"
                        elif module.lower() == "channel":
                            entity_type = "Channel"

                        record_audit_event(
                            db_session=db,
                            module=module,
                            action_type=action_type,
                            entity_type=entity_type,
                            entity_id=entity_id_val,
                            method=method,
                            path=path
                        )

                    # Commit only if read_only is True, or if the decorator created its own session
                    if read_only or own_session:
                        db.commit()
                    if own_session:
                        db.close()
                    return result
                except Exception as e:
                    if own_session:
                        db.rollback()
                        db.close()
                    raise e
                finally:
                    event.remove(db, "before_commit", receive_before_commit)
            return async_wrapper
        else:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                db, request, entity_id = scan_arguments(args, kwargs)
                own_session = False
                if db is None:
                    db = SessionLocal()
                    own_session = True
                    if db_param_name:
                        kwargs[db_param_name] = db

                method = request.method if request else None
                path = request.url.path if request else None

                context.audit_logged_var.set(False)
                audit_record_created = False

                def receive_before_commit(session):
                    nonlocal audit_record_created
                    if not audit_record_created and not context.audit_logged_var.get():
                        entity_id_val = entity_id
                        if entity_id_val is None:
                            for obj in session.new:
                                if obj.__class__.__name__.lower() == module.lower():
                                    session.flush()
                                    entity_id_val = getattr(obj, "id", None)
                                    break
                            if entity_id_val is None:
                                for obj in session.identity_map.values():
                                    if obj.__class__.__name__.lower() == module.lower():
                                        entity_id_val = getattr(obj, "id", None)
                                        break

                        entity_type = None
                        if module.lower() == "product":
                            entity_type = "Product"
                        elif module.lower() == "category":
                            entity_type = "Category"
                        elif module.lower() == "channel":
                            entity_type = "Channel"

                        record_audit_event(
                            db_session=session,
                            module=module,
                            action_type=action_type,
                            entity_type=entity_type,
                            entity_id=entity_id_val,
                            method=method,
                            path=path
                        )
                        audit_record_created = True

                try:
                    event.listen(db, "before_commit", receive_before_commit)
                    result = func(*args, **kwargs)
                    
                    if not context.audit_logged_var.get():
                        # Extract entity_id from result if not found in args/kwargs
                        entity_id_val = entity_id
                        if entity_id_val is None and result is not None:
                            if hasattr(result, "id"):
                                entity_id_val = result.id
                            elif isinstance(result, dict) and "id" in result:
                                entity_id_val = result["id"]

                        entity_type = None
                        if module.lower() == "product":
                            entity_type = "Product"
                        elif module.lower() == "category":
                            entity_type = "Category"
                        elif module.lower() == "channel":
                            entity_type = "Channel"

                        record_audit_event(
                            db_session=db,
                            module=module,
                            action_type=action_type,
                            entity_type=entity_type,
                            entity_id=entity_id_val,
                            method=method,
                            path=path
                        )

                    # Commit only if read_only is True, or if the decorator created its own session
                    if read_only or own_session:
                        db.commit()
                    if own_session:
                        db.close()
                    return result
                except Exception as e:
                    if own_session:
                        db.rollback()
                        db.close()
                    raise e
                finally:
                    event.remove(db, "before_commit", receive_before_commit)
            return sync_wrapper
    return decorator
