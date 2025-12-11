from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (
        Index("idx_comment_entity", "entity_type", "entity_id"),
        Index("idx_comment_thread", "parent_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # Polymorphic target (experiment, scenario, project)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)

    # Threading support (adjacency list pattern)
    parent_id = Column(Integer, ForeignKey("comments.id"), nullable=True)
    thread_level = Column(Integer, default=0)  # Cap at 3 levels

    # Content
    content = Column(Text, nullable=False)

    # Metadata
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_deleted = Column(Boolean, default=False)  # Soft delete for threads

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="comments")
    parent = relationship("Comment", remote_side=[id], backref="replies")
