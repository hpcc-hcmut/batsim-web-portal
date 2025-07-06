from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Workload(Base):
    __tablename__ = "workloads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    file_type = Column(String)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    nb_res = Column(Integer, nullable=True)
    jobs = Column(Text, nullable=True)  # Store as JSON string
    profiles = Column(Text, nullable=True)  # Store as JSON string

    # Relationships
    creator = relationship("User", back_populates="workloads")
    scenarios = relationship("Scenario", back_populates="workload")
