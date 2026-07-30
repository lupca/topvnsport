import datetime
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import relationship
from database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    sellers = relationship("Seller", back_populates="tenant")
    staff_accounts = relationship("StaffAccount", back_populates="tenant")


class Seller(Base):
    __tablename__ = "sellers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "tax_code", name="uq_sellers_tenant_tax_code"),
    )

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    tax_code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    tenant = relationship("Tenant", back_populates="sellers")


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # e.g., "admin", "pmi_staff", "viewer"
    name = Column(String(100), nullable=False)                         # e.g., "Quản trị viên", "Nhân viên PMI"
    description = Column(String(500), nullable=True)
    
    # Permissions stored as a JSON array of strings
    permissions = Column(JSON, default=list, nullable=False)            # e.g., ["pmi:read", "oms:write"]
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    staff_accounts = relationship("StaffAccount", back_populates="role")
 
 
class StaffAccount(Base):
    __tablename__ = "staff_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    # Contracted by PMI-030 after the nullable expand/backfill window.
    tenant_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)
    
    role = relationship("Role", back_populates="staff_accounts")
    tenant = relationship("Tenant", back_populates="staff_accounts")
    sessions = relationship("StaffSession", back_populates="staff", cascade="all, delete-orphan")

    @property
    def role_code(self) -> str:
        return self.role.code if self.role else None

    @property
    def role_name(self) -> str:
        return self.role.name if self.role else None

    @property
    def tenant_code(self) -> str:
        return self.tenant.code if self.tenant else None


class StaffSession(Base):
    __tablename__ = "staff_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff_accounts.id", ondelete="CASCADE"), nullable=False)
    
    refresh_token_hash = Column(String(255), nullable=False, index=True)
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6 length compliant
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    
    staff = relationship("StaffAccount", back_populates="sessions")
