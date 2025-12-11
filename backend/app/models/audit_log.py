from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class AuditAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    START = "start"
    STOP = "stop"
    PAUSE = "pause"
    RESUME = "resume"


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("idx_audit_timestamp_desc", "created_at"),
        Index("idx_audit_user_timestamp", "user_id", "created_at"),
        Index("idx_audit_entity", "entity_type", "entity_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(20), nullable=False)  # AuditAction values
    entity_type = Column(String(50), nullable=False)  # workload, platform, experiment, etc.
    entity_id = Column(Integer, nullable=False)
    entity_name = Column(String(255), nullable=True)  # Snapshot of name at action time
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    # JSON changes column (stored as Text for SQLite compatibility)
    changes = Column(Text, nullable=True)  # JSON: {"field": {"old": x, "new": y}}

    # Request context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", backref="audit_logs")
    project = relationship("Project", backref="audit_logs")
