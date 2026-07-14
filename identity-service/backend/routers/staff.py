from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, Field

from database import get_db
from models import StaffAccount
from schemas.staff import StaffCreate, StaffUpdate, StaffOut
from routers.auth import get_current_active_staff
import services.staff_service as staff_service

router = APIRouter(prefix="/staff", tags=["staff"])

class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)

def require_admin_privileges(current_user: StaffAccount = Depends(get_current_active_staff)) -> StaffAccount:
    """
    Dependency to verify that the logged-in staff member has admin role/permission.
    """
    role = current_user.role
    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện hành động này"
        )
    
    # Check if role code is "admin" or has "identity:*" permission
    has_admin_permission = "identity:*" in role.permissions or "*" in role.permissions
    is_admin = role.code == "admin" or has_admin_permission
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện hành động này"
        )
    return current_user

@router.get("/", response_model=List[StaffOut])
def list_staff(
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    List all staff accounts.
    """
    return staff_service.get_staff_accounts(db)

@router.get("/{staff_id}", response_model=StaffOut)
def get_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    Get a staff account by ID.
    """
    db_staff = staff_service.get_staff_account_by_id(db, staff_id)
    if not db_staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản nhân viên"
        )
    return db_staff

@router.post("/", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(
    staff_in: StaffCreate,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    Create a new staff account.
    """
    return staff_service.create_staff_account(db, staff_in)

@router.put("/{staff_id}", response_model=StaffOut)
def update_staff(
    staff_id: int,
    staff_in: StaffUpdate,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    Update a staff account.
    """
    return staff_service.update_staff_account(db, staff_id, staff_in)

@router.delete("/{staff_id}")
def delete_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    Delete a staff account.
    """
    # Prevent self-deletion
    if admin.id == staff_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tự xóa tài khoản của chính mình"
        )
    staff_service.delete_staff_account(db, staff_id)
    return {"message": "Xóa tài khoản thành công"}

@router.post("/{staff_id}/reset-password")
def reset_password(
    staff_id: int,
    req: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    Reset password for a staff account.
    """
    staff_service.reset_staff_password(db, staff_id, req.new_password)
    return {"message": "Đặt lại mật khẩu thành công"}
