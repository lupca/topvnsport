from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from database import get_db
from models import StaffAccount, Tenant
from schemas.auth import LoginRequest, LoginResponse, RefreshTokenRequest, VerifyResponse, ChangePasswordRequest
from schemas.staff import StaffOut
from services.auth_service import authenticate_staff, refresh_tokens, revoke_session, change_staff_password
from utils.jwt import decode_access_token
from utils.api_keys import looks_like_api_key
from services.api_key_service import authenticate_api_key

API_KEY_ROLE = "api_key"

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
        
    staff = db.query(StaffAccount).join(Tenant).filter(
        StaffAccount.id == staff_id,
        StaffAccount.is_active.is_(True),
        Tenant.is_active.is_(True),
    ).first()
    if not staff:
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

    Two credential types are accepted:

    * ``X-API-Key: vk_…`` – per-seller external API key. The key decides the
      tenant *and* seller; it is restricted to the method/path allowlist of its
      scopes (``X-Original-Method`` / ``X-Original-URI`` sent by the gateway).
    * JWT (``Authorization: Bearer`` or ``access_token`` cookie) – staff user.
      The client's ``X-Seller-Id`` is echoed back unchanged so the gateway can
      always forward the seller from this response.

    Any other ``X-API-Key`` value (e.g. the internal service token) is ignored
    here: it never authenticates a gateway request.
    """
    raw_api_key = request.headers.get("X-API-Key")
    if looks_like_api_key(raw_api_key):
        return _verify_api_key(request, response, db, raw_api_key)

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
            detail="Invalid or expired JWT token"
        )
        
    staff = db.query(StaffAccount).join(Tenant).filter(
        StaffAccount.id == staff_id,
        StaffAccount.is_active.is_(True),
        Tenant.is_active.is_(True),
    ).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired JWT token"
        )
        
    role_code = staff.role_code
    role = staff.role
    permissions = role.permissions if role else []
    requested_seller = request.headers.get("X-Seller-Id") or None
    
    # Set headers Nginx will capture/forward
    response.headers["X-User-Id"] = str(staff_id)
    response.headers["X-User-Username"] = staff.username
    response.headers["X-User-Role"] = role_code or ""
    response.headers["X-User-Permissions"] = ",".join(permissions)
    response.headers["X-Tenant-Id"] = str(staff.tenant.id)
    response.headers["X-Tenant-Code"] = staff.tenant.code
    if requested_seller:
        # Unchanged pass-through: seller selection for staff is validated by
        # the backends exactly as before.
        response.headers["X-Seller-Id"] = requested_seller
    
    return VerifyResponse(
        valid=True,
        user_id=staff_id,
        username=staff.username,
        role=role_code,
        permissions=permissions,
        tenant_id=staff.tenant.id,
        tenant_code=staff.tenant.code,
        seller_id=requested_seller,
    )


def _verify_api_key(
    request: Request, response: Response, db: Session, raw_api_key: str
) -> VerifyResponse:
    if request.headers.get("Authorization"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chỉ được dùng một phương thức xác thực (API key hoặc JWT)",
        )
    api_key = authenticate_api_key(
        db,
        raw_api_key,
        method=request.headers.get("X-Original-Method"),
        original_uri=request.headers.get("X-Original-URI"),
        requested_seller=request.headers.get("X-Seller-Id"),
    )
    tenant = api_key.tenant
    # Same identity headers as a staff request, so backends need no change.
    response.headers["X-User-Id"] = f"apikey:{api_key.id}"
    response.headers["X-User-Username"] = f"apikey:{api_key.prefix}"
    response.headers["X-User-Role"] = API_KEY_ROLE
    response.headers["X-User-Permissions"] = ""
    response.headers["X-Tenant-Id"] = str(tenant.id)
    response.headers["X-Tenant-Code"] = tenant.code
    response.headers["X-Seller-Id"] = str(api_key.seller_id)
    response.headers["X-Auth-Type"] = "api_key"
    return VerifyResponse(
        valid=True,
        username=f"apikey:{api_key.prefix}",
        role=API_KEY_ROLE,
        permissions=[],
        tenant_id=tenant.id,
        tenant_code=tenant.code,
        seller_id=str(api_key.seller_id),
        auth_type="api_key",
        api_key_id=api_key.id,
        scopes=list(api_key.scopes or []),
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
