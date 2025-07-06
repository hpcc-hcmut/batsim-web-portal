from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    file_type = Column(String, default="python")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    # Strategy metadata
    nb_files = Column(Integer, nullable=True)
    main_entry = Column(String, nullable=True)  # Main entry point file
    strategy_files = Column(Text, nullable=True)  # Store as JSON string

    # Relationships
    creator = relationship("User", back_populates="strategies")
    experiments = relationship("Experiment", back_populates="strategy")
