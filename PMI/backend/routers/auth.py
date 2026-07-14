from fastapi import APIRouter, Depends, HTTPException, status
from utils.dependency import get_current_identity

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.get("/me")
async def get_me(identity: dict = Depends(get_current_identity)):
    """Return identity context of the authenticated actor."""
    res = {
        "actor_type": identity["actor_type"],
        "actor_username": identity["actor_username"]
    }
    if identity.get("actor_type") == "USER":
        res["user"] = {
            "id": identity.get("actor_id"),
            "username": identity.get("actor_username"),
            "email": None,
            "role": identity.get("role"),
            "is_active": True,
            "created_at": None
        }
    return res

@router.get("/context")
async def get_context():
    """Return current request context vars."""
    import os
    if os.getenv("TESTING", "false").lower() != "true":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: context endpoint is only enabled in testing environment")
    from utils.context import get_actor_username, get_actor_type, get_ip_address, get_correlation_id
    return {
        "actor_username": get_actor_username(),
        "actor_type": get_actor_type(),
        "ip_address": get_ip_address(),
        "correlation_id": get_correlation_id()
    }

@router.get("/me_context")
async def get_me_context(identity: dict = Depends(get_current_identity)):
    """Return current request context vars after running dependency."""
    from utils.context import get_actor_username, get_actor_type, get_ip_address, get_correlation_id
    return {
        "actor_username": get_actor_username(),
        "actor_type": get_actor_type(),
        "ip_address": get_ip_address(),
        "correlation_id": get_correlation_id()
    }

