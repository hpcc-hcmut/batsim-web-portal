from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Platform(Base):
    __tablename__ = "platforms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    file_type = Column(String)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    nb_hosts = Column(Integer, nullable=True)
    nb_clusters = Column(Integer, nullable=True)
    platform_config = Column(Text, nullable=True)  # Store as XML string
    version = Column(Integer, default=1, nullable=False)

    # Relationships
    creator = relationship("User", back_populates="platforms")
    # passive_deletes=False: ORM walks scenario->experiment chain so storage cleanup hooks fire.
    scenarios = relationship("Scenario", back_populates="platform", cascade="all, delete-orphan", passive_deletes=False)
