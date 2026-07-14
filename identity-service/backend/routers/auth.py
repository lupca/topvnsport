from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import StaffAccount
from schemas.auth import LoginRequest, LoginResponse, RefreshTokenRequest, VerifyResponse, ChangePasswordRequest
from schemas.staff import StaffOut
from services.auth_service import authenticate_staff, refresh_tokens, revoke_session, change_staff_password
from utils.jwt import decode_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

def get_current_active_staff(
    request: Request,
    db: Session = Depends(get_db)
) -> StaffAccount:
    """
    Dependency to validate the JWT access token and return the authenticated active staff account.
    """
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        token = request.cookies.get("access_token")
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing"
        )
        
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired JWT token"
        )
        
    staff_id = payload.get("staff_id")
    if not staff_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing subject claim"
        )
        
    staff = db.query(StaffAccount).filter(StaffAccount.id == staff_id).first()
    if not staff or not staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản không tồn tại hoặc đã bị khóa"
        )
    return staff

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Log in a staff member and return access and refresh tokens.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    return authenticate_staff(
        db, 
        username_or_email=req.username, 
        password=req.password, 
        ip_address=ip_address, 
        user_agent=user_agent
    )

@router.post("/refresh", response_model=LoginResponse)
def refresh(req: RefreshTokenRequest, request: Request, db: Session = Depends(get_db)):
    """
    Refresh tokens using a valid refresh token.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    return refresh_tokens(
        db, 
        refresh_token=req.refresh_token, 
        ip_address=ip_address, 
        user_agent=user_agent
    )

@router.get("/verify", response_model=VerifyResponse)
def verify(request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Internal endpoint for Nginx auth_request forwarding.
    """
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        token = request.cookies.get("access_token")
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing"
        )
        
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired JWT token"
        )
        
    staff_id = payload.get("staff_id")
    username = payload.get("username")
    
    if not staff_id or not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired JWT token"
        )
        
    staff = db.query(StaffAccount).filter(StaffAccount.id == staff_id).first()
    if not staff or not staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired JWT token"
        )
        
    role_code = staff.role_code
    role = staff.role
    permissions = role.permissions if role else []
    
    # Set headers Nginx will capture/forward
    response.headers["X-User-Id"] = str(staff_id)
    response.headers["X-User-Username"] = username
    response.headers["X-User-Role"] = role_code or ""
    response.headers["X-User-Permissions"] = ",".join(permissions)
    
    return VerifyResponse(
        valid=True,
        user_id=staff_id,
        username=username,
        role=role_code,
        permissions=permissions
    )

@router.post("/logout")
def logout(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Revoke a refresh token and log out the user session.
    """
    revoke_session(db, req.refresh_token)
    return {"message": "Đăng xuất thành công"}

@router.get("/me", response_model=StaffOut)
def me(current_user: StaffAccount = Depends(get_current_active_staff)):
    """
    Return the current active user's staff account profile.
    """
    return current_user

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: StaffAccount = Depends(get_current_active_staff),
    db: Session = Depends(get_db)
):
    """
    Change the current active user's password.
    """
    change_staff_password(db, current_user.id, req.current_password, req.new_password)
    return {"message": "Thay đổi mật khẩu thành công"}
