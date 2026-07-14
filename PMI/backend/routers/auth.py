from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
import models
from utils.auth import verify_password, create_access_token
from utils.dependency import get_current_identity

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate credentials and generate a JWT access token."""
    user = db.query(models.User).filter(models.User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated"
        )

    # Generate token
    token = create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me")
async def get_me(identity: dict = Depends(get_current_identity)):
    """Return identity context of the authenticated actor."""
    res = {
        "actor_type": identity["actor_type"],
        "actor_username": identity["actor_username"]
    }
    if "user" in identity:
        user = identity["user"]
        res["user"] = {
            "id": getattr(user, "id", None),
            "username": getattr(user, "username", None),
            "email": getattr(user, "email", None),
            "role": getattr(user, "role", None),
            "is_active": getattr(user, "is_active", None),
            "created_at": getattr(user, "created_at", None).isoformat() if getattr(user, "created_at", None) else None
        }
    elif identity.get("actor_type") == "USER":
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

