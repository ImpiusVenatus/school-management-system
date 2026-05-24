"""Append-only audit trail for state-changing API actions."""
from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(40), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    actor_name = Column(String(200), nullable=False, default="System")
    actor_role = Column(String(80), nullable=True)
    action = Column(String(120), nullable=False, index=True)
    category = Column(String(32), nullable=False, index=True)  # write | admin | auth | security | system
    resource_type = Column(String(80), nullable=True)
    resource_id = Column(String(80), nullable=True, index=True)
    resource_label = Column(String(255), nullable=True)
    http_method = Column(String(10), nullable=True)
    path = Column(String(500), nullable=True)
    status_code = Column(Integer, nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(300), nullable=True)
    details_json = Column(Text, nullable=True)
