from sqlalchemy import Column, Integer, String, Enum, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER)
    is_active = Column(String, default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships — no cascade; DB SET NULL handles created_by on user delete
    workloads = relationship("Workload", back_populates="creator", passive_deletes=True)
    platforms = relationship("Platform", back_populates="creator", passive_deletes=True)
    scenarios = relationship("Scenario", back_populates="creator", passive_deletes=True)
    strategies = relationship("Strategy", back_populates="creator", passive_deletes=True)
    experiments = relationship("Experiment", back_populates="creator", passive_deletes=True)
