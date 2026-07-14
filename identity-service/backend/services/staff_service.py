import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from models import StaffAccount, Role, StaffSession
from schemas.staff import StaffCreate, StaffUpdate
from schemas.role import RoleCreate, RoleUpdate
from utils.password import hash_password

# --- Staff Accounts CRUD & Reset Password ---

def get_staff_accounts(db: Session) -> List[StaffAccount]:
    """Retrieve all staff accounts."""
    return db.query(StaffAccount).all()

def get_staff_account_by_id(db: Session, staff_id: int) -> Optional[StaffAccount]:
    """Retrieve a staff account by ID."""
    return db.query(StaffAccount).filter(StaffAccount.id == staff_id).first()

def create_staff_account(db: Session, staff_in: StaffCreate) -> StaffAccount:
    """Create a new staff account after validating uniqueness and role existence."""
    if db.query(StaffAccount).filter(StaffAccount.username == staff_in.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập đã tồn tại"
        )
    if db.query(StaffAccount).filter(StaffAccount.email == staff_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email đã tồn tại"
        )
    role = db.query(Role).filter(Role.id == staff_in.role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nhóm quyền không tồn tại"
        )
        
    db_staff = StaffAccount(
        username=staff_in.username,
        email=staff_in.email,
        hashed_password=hash_password(staff_in.password),
        full_name=staff_in.full_name,
        role_id=staff_in.role_id,
        is_active=True
    )
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
    return db_staff

def update_staff_account(db: Session, staff_id: int, staff_in: StaffUpdate) -> StaffAccount:
    """Update an existing staff account's fields."""
    db_staff = get_staff_account_by_id(db, staff_id)
    if not db_staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản nhân viên"
        )
        
    if staff_in.email is not None:
        duplicate = db.query(StaffAccount).filter(
            StaffAccount.email == staff_in.email,
            StaffAccount.id != staff_id
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email đã tồn tại"
            )
        db_staff.email = staff_in.email
        
    if staff_in.full_name is not None:
        db_staff.full_name = staff_in.full_name
        
    if staff_in.role_id is not None:
        role = db.query(Role).filter(Role.id == staff_in.role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nhóm quyền không tồn tại"
            )
        db_staff.role_id = staff_in.role_id
        
    if staff_in.is_active is not None:
        db_staff.is_active = staff_in.is_active
        
    db.commit()
    db.refresh(db_staff)
    return db_staff

def delete_staff_account(db: Session, staff_id: int) -> None:
    """Delete a staff account by ID."""
    db_staff = get_staff_account_by_id(db, staff_id)
    if not db_staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản nhân viên"
        )
    db.delete(db_staff)
    db.commit()

def reset_staff_password(db: Session, staff_id: int, new_password: str) -> None:
    """Reset a staff account's password by an administrator."""
    db_staff = get_staff_account_by_id(db, staff_id)
    if not db_staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản nhân viên"
        )
    db_staff.hashed_password = hash_password(new_password)
    
    # Revoke all active sessions for the user
    active_sessions = db.query(StaffSession).filter(
        StaffSession.staff_id == staff_id,
        StaffSession.revoked_at == None,
        StaffSession.expires_at > datetime.datetime.utcnow()
    ).all()
    for session in active_sessions:
        session.revoked_at = datetime.datetime.utcnow()
        
    db.commit()


# --- Roles CRUD ---

def get_roles(db: Session) -> List[Role]:
    """Retrieve all roles."""
    return db.query(Role).all()

def get_role_by_id(db: Session, role_id: int) -> Optional[Role]:
    """Retrieve a role by ID."""
    return db.query(Role).filter(Role.id == role_id).first()

def create_role(db: Session, role_in: RoleCreate) -> Role:
    """Create a new role after validating uniqueness of its code."""
    if db.query(Role).filter(Role.code == role_in.code).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã nhóm quyền đã tồn tại"
        )
        
    db_role = Role(
        code=role_in.code,
        name=role_in.name,
        description=role_in.description,
        permissions=role_in.permissions
    )
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

def update_role(db: Session, role_id: int, role_in: RoleUpdate) -> Role:
    """Update an existing role's fields (code is immutable)."""
    db_role = get_role_by_id(db, role_id)
    if not db_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy nhóm quyền"
        )
        
    if role_in.name is not None:
        db_role.name = role_in.name
    if role_in.description is not None:
        db_role.description = role_in.description
    if role_in.permissions is not None:
        db_role.permissions = role_in.permissions
        
    db.commit()
    db.refresh(db_role)
    return db_role

def delete_role(db: Session, role_id: int) -> None:
    """Delete a role by ID, ensuring no staff accounts are associated with it."""
    db_role = get_role_by_id(db, role_id)
    if not db_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy nhóm quyền"
        )
        
    staff_count = db.query(StaffAccount).filter(StaffAccount.role_id == role_id).count()
    if staff_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể xóa nhóm quyền đang có tài khoản sử dụng"
        )
        
    db.delete(db_role)
    db.commit()
