from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="owned_projects")
    members = relationship(
        "ProjectMember", back_populates="project", cascade="all, delete-orphan"
    )
    workloads = relationship("Workload", back_populates="project")
    platforms = relationship("Platform", back_populates="project")
    scenarios = relationship("Scenario", back_populates="project")
    strategies = relationship("Strategy", back_populates="project")
    experiments = relationship("Experiment", back_populates="project")
