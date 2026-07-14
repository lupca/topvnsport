from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import StaffAccount
from schemas.role import RoleCreate, RoleUpdate, RoleOut
from routers.auth import get_current_active_staff
from routers.staff import require_admin_privileges
import services.staff_service as staff_service

router = APIRouter(prefix="/roles", tags=["roles"])

@router.get("/", response_model=List[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    List all roles.
    """
    return staff_service.get_roles(db)

@router.get("/{role_id}", response_model=RoleOut)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    Get a role by ID.
    """
    db_role = staff_service.get_role_by_id(db, role_id)
    if not db_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy nhóm quyền"
        )
    return db_role

@router.post("/", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    role_in: RoleCreate,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    Create a new role.
    """
    return staff_service.create_role(db, role_in)

@router.put("/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int,
    role_in: RoleUpdate,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    Update a role.
    """
    return staff_service.update_role(db, role_id, role_in)

@router.delete("/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges)
):
    """
    Delete a role. Blocked if any staff account is associated with the role.
    """
    staff_service.delete_role(db, role_id)
    return {"message": "Xóa nhóm quyền thành công"}
