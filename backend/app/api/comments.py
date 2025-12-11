from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.comment import Comment
from app.schemas.comment import CommentCreate, CommentUpdate, CommentResponse, CommentThread
from app.api.auth import get_current_user

router = APIRouter()

MAX_THREAD_LEVEL = 3  # Cap reply depth


@router.post("/", response_model=CommentResponse)
def create_comment(
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new comment or reply."""
    thread_level = 0

    # Validate parent if replying
    if comment_data.parent_id:
        parent = db.query(Comment).filter(Comment.id == comment_data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent.entity_type != comment_data.entity_type or parent.entity_id != comment_data.entity_id:
            raise HTTPException(status_code=400, detail="Reply must be on same entity")
        if parent.thread_level >= MAX_THREAD_LEVEL:
            raise HTTPException(status_code=400, detail=f"Max thread depth ({MAX_THREAD_LEVEL}) reached")
        thread_level = parent.thread_level + 1

    comment = Comment(
        entity_type=comment_data.entity_type,
        entity_id=comment_data.entity_id,
        parent_id=comment_data.parent_id,
        thread_level=thread_level,
        content=comment_data.content,
        user_id=current_user.id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        content=comment.content,
        entity_type=comment.entity_type,
        entity_id=comment.entity_id,
        parent_id=comment.parent_id,
        thread_level=comment.thread_level,
        user_id=comment.user_id,
        username=current_user.username,
        is_deleted=comment.is_deleted,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        reply_count=0,
    )


@router.get("/", response_model=List[CommentResponse])
def get_comments(
    entity_type: str = Query(..., pattern="^(experiment|scenario|project)$"),
    entity_id: int = Query(...),
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get flat list of comments for an entity."""
    query = db.query(Comment).filter(
        Comment.entity_type == entity_type,
        Comment.entity_id == entity_id,
    )
    if not include_deleted:
        query = query.filter(Comment.is_deleted == False)

    comments = query.order_by(Comment.created_at).all()

    # Add usernames and reply counts
    user_ids = {c.user_id for c in comments}
    users = {u.id: u.username for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    reply_counts = dict(
        db.query(Comment.parent_id, func.count(Comment.id))
        .filter(Comment.parent_id.isnot(None), Comment.is_deleted == False)
        .group_by(Comment.parent_id)
        .all()
    )

    result = []
    for c in comments:
        item = CommentResponse(
            id=c.id,
            content=c.content,
            entity_type=c.entity_type,
            entity_id=c.entity_id,
            parent_id=c.parent_id,
            thread_level=c.thread_level,
            user_id=c.user_id,
            username=users.get(c.user_id),
            is_deleted=c.is_deleted,
            created_at=c.created_at,
            updated_at=c.updated_at,
            reply_count=reply_counts.get(c.id, 0),
        )
        result.append(item)

    return result


@router.get("/threaded", response_model=List[CommentThread])
def get_comments_threaded(
    entity_type: str = Query(..., pattern="^(experiment|scenario|project)$"),
    entity_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get comments as threaded structure (root comments with nested replies)."""
    all_comments = (
        db.query(Comment)
        .filter(
            Comment.entity_type == entity_type,
            Comment.entity_id == entity_id,
            Comment.is_deleted == False,
        )
        .order_by(Comment.created_at)
        .all()
    )

    # Build username map
    user_ids = {c.user_id for c in all_comments}
    users = {u.id: u.username for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    # Build threaded structure
    comment_map = {}
    roots = []

    for c in all_comments:
        item = CommentThread(
            id=c.id,
            content=c.content,
            entity_type=c.entity_type,
            entity_id=c.entity_id,
            parent_id=c.parent_id,
            thread_level=c.thread_level,
            user_id=c.user_id,
            username=users.get(c.user_id),
            is_deleted=c.is_deleted,
            created_at=c.created_at,
            updated_at=c.updated_at,
            reply_count=0,
            replies=[],
        )
        comment_map[c.id] = item

        if c.parent_id is None:
            roots.append(item)
        else:
            parent = comment_map.get(c.parent_id)
            if parent:
                parent.replies.append(item)
                parent.reply_count = len(parent.replies)

    return roots


@router.put("/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: int,
    update_data: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update own comment content."""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only edit own comments")
    if comment.is_deleted:
        raise HTTPException(status_code=400, detail="Cannot edit deleted comment")

    comment.content = update_data.content
    db.commit()
    db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        content=comment.content,
        entity_type=comment.entity_type,
        entity_id=comment.entity_id,
        parent_id=comment.parent_id,
        thread_level=comment.thread_level,
        user_id=comment.user_id,
        username=current_user.username,
        is_deleted=comment.is_deleted,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        reply_count=0,
    )


@router.delete("/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete a comment (preserves thread structure)."""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Allow owner or admin to delete
    if comment.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    comment.is_deleted = True
    comment.content = "[deleted]"
    db.commit()

    return {"message": "Comment deleted"}
