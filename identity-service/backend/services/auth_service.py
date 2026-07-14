import datetime
import hashlib
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from models import StaffAccount, StaffSession
from utils.password import verify_password, hash_password
from utils.jwt import create_access_token, create_refresh_token, ACCESS_TOKEN_EXPIRE_MINUTES

def hash_refresh_token(token: str) -> str:
    """
    Hash a refresh token using SHA-256.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def authenticate_staff(
    db: Session, 
    username_or_email: str, 
    password: str, 
    ip_address: Optional[str] = None, 
    user_agent: Optional[str] = None
) -> dict:
    """
    Authenticate a staff member by username/email and password,
    generate tokens, and save the session.
    """
    account = db.query(StaffAccount).filter(
        (StaffAccount.username == username_or_email) | (StaffAccount.email == username_or_email)
    ).first()
    
    if not account or not verify_password(password, account.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập/Email hoặc mật khẩu không chính xác"
        )
    
    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị khóa"
        )
        
    role_code = account.role_code or ""
    access_token = create_access_token(
        staff_id=account.id,
        username=account.username,
        role=role_code
    )
    
    refresh_token, expires_at = create_refresh_token(account.id)
    rf_hash = hash_refresh_token(refresh_token)
    
    session = StaffSession(
        staff_id=account.id,
        refresh_token_hash=rf_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at
    )
    db.add(session)
    
    account.last_login_at = datetime.datetime.utcnow()
    db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

def refresh_tokens(
    db: Session, 
    refresh_token: str, 
    ip_address: Optional[str] = None, 
    user_agent: Optional[str] = None
) -> dict:
    """
    Rotate tokens using a valid refresh token. Revokes the old session
    and creates a new one.
    """
    rf_hash = hash_refresh_token(refresh_token)
    session = db.query(StaffSession).filter(
        StaffSession.refresh_token_hash == rf_hash,
        StaffSession.revoked_at == None,
        StaffSession.expires_at > datetime.datetime.utcnow()
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token không hợp lệ hoặc đã hết hạn"
        )
        
    account = db.query(StaffAccount).filter(StaffAccount.id == session.staff_id).first()
    if not account or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản không tồn tại hoặc đã bị khóa"
        )
        
    # Revoke old session
    session.revoked_at = datetime.datetime.utcnow()
    
    role_code = account.role_code or ""
    new_access_token = create_access_token(
        staff_id=account.id,
        username=account.username,
        role=role_code
    )
    
    new_refresh_token, new_expires_at = create_refresh_token(account.id)
    new_rf_hash = hash_refresh_token(new_refresh_token)
    
    new_session = StaffSession(
        staff_id=account.id,
        refresh_token_hash=new_rf_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=new_expires_at
    )
    db.add(new_session)
    db.commit()
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

def revoke_session(db: Session, refresh_token: str) -> None:
    """
    Revoke a staff session by its refresh token.
    """
    rf_hash = hash_refresh_token(refresh_token)
    session = db.query(StaffSession).filter(
        StaffSession.refresh_token_hash == rf_hash
    ).first()
    
    if session:
        session.revoked_at = datetime.datetime.utcnow()
        db.commit()

def change_staff_password(db: Session, staff_id: int, current_password: str, new_password: str) -> None:
    """
    Change a staff member's password after validating the current password.
    """
    account = db.query(StaffAccount).filter(StaffAccount.id == staff_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài khoản không tồn tại"
        )
        
    if not verify_password(current_password, account.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác"
        )
        
    account.hashed_password = hash_password(new_password)
    
    # Revoke all active sessions for the user
    active_sessions = db.query(StaffSession).filter(
        StaffSession.staff_id == staff_id,
        StaffSession.revoked_at == None,
        StaffSession.expires_at > datetime.datetime.utcnow()
    ).all()
    for session in active_sessions:
        session.revoked_at = datetime.datetime.utcnow()
        
    db.commit()
