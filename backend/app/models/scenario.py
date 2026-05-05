from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    workload_id = Column(Integer, ForeignKey("workloads.id", ondelete="CASCADE"), nullable=False)
    platform_id = Column(Integer, ForeignKey("platforms.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    workload = relationship("Workload", back_populates="scenarios")
    platform = relationship("Platform", back_populates="scenarios")
    creator = relationship("User", back_populates="scenarios")
    # passive_deletes=False: ORM loads + deletes children individually so
    # Experiment.before_delete fires (storage cleanup). DB-level CASCADE remains
    # as defense-in-depth for raw SQL paths.
    experiments = relationship("Experiment", back_populates="scenario", cascade="all, delete-orphan", passive_deletes=False)
