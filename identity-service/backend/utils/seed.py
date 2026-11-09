from sqlalchemy.orm import Session
import uuid

from models import Role, StaffAccount, Tenant
from utils.password import hash_password

DEFAULT_TENANT_ID = uuid.UUID("eadb17a4-1b2d-5ffd-8d99-6091f167aeef")


def seed_initial_data(db: Session):
    # Create default roles
    roles_data = [
        {
            "code": "admin",
            "name": "Quản trị viên",
            "description": "Toàn quyền trên tất cả hệ thống",
            "permissions": ["pmi:*", "oms:*", "wms:*", "identity:*"]
        },
        {
            "code": "pmi_staff",
            "name": "Nhân viên PMI",
            "description": "Quản lý sản phẩm",
            "permissions": ["pmi:read", "pmi:write"]
        },
        {
            "code": "oms_staff",
            "name": "Nhân viên OMS",
            "description": "Quản lý đơn hàng",
            "permissions": ["oms:read", "oms:write", "pmi:read"]
        },
        {
            "code": "wms_staff",
            "name": "Nhân viên WMS",
            "description": "Quản lý kho",
            "permissions": ["wms:read", "wms:write", "pmi:read"]
        },
        {
            "code": "viewer",
            "name": "Người xem",
            "description": "Chỉ xem, không chỉnh sửa",
            "permissions": ["pmi:read", "oms:read", "wms:read"]
        }
    ]
    
    for role_data in roles_data:
        existing = db.query(Role).filter(Role.code == role_data["code"]).first()
        if not existing:
            db.add(Role(**role_data))
    
    db.commit()
    
    # Create default admin account
    admin_role = db.query(Role).filter(Role.code == "admin").first()
    existing_admin = db.query(StaffAccount).filter(StaffAccount.username == "admin").first()
    
    # staff_accounts.tenant_id is NOT NULL: attach the bootstrap admin to the
    # deterministic default tenant created by migration 20260730_000002.
    default_tenant = db.get(Tenant, DEFAULT_TENANT_ID) or db.query(Tenant).order_by(Tenant.code).first()

    if not existing_admin and admin_role and default_tenant:
        admin = StaffAccount(
            tenant_id=default_tenant.id,
            username="admin",
            email="admin@topvnsport.com",
            hashed_password=hash_password("Admin@123"),
            full_name="System Administrator",
            role_id=admin_role.id,
            is_active=True
        )
        db.add(admin)
        db.commit()
