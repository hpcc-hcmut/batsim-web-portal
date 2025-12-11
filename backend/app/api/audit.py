import json
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.models.project_member import ProjectMember
from app.schemas.audit_log import AuditLogResponse, AuditLogListResponse
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=AuditLogListResponse)
def get_audit_logs(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[int] = Query(None, description="Filter by entity ID"),
    user_id: Optional[int] = Query(None, description="Filter by user"),
    project_id: Optional[int] = Query(None, description="Filter by project"),
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Pagination cursor (timestamp)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get audit logs with cursor-based pagination.
    Admin: all logs. Others: own actions + project actions if member.
    """
    query = db.query(AuditLog)

    # RBAC filtering
    if current_user.role != UserRole.ADMIN:
        # Users see their own actions + actions in their projects
        member_project_ids = db.query(ProjectMember.project_id).filter(
            ProjectMember.user_id == current_user.id
        ).subquery()
        query = query.filter(
            (AuditLog.user_id == current_user.id) |
            (AuditLog.project_id.in_(member_project_ids))
        )

    # Apply filters
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if project_id:
        query = query.filter(AuditLog.project_id == project_id)

    # Cursor-based pagination
    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.filter(AuditLog.created_at < cursor_dt)
        except ValueError:
            pass  # Invalid cursor, ignore

    # Get total count (for first page only, expensive)
    total = query.count() if not cursor else 0

    # Fetch results
    logs = query.order_by(desc(AuditLog.created_at)).limit(limit + 1).all()

    # Determine next cursor
    has_more = len(logs) > limit
    if has_more:
        logs = logs[:limit]
    next_cursor = logs[-1].created_at.isoformat() if has_more and logs else None

    # Populate usernames via join
    user_ids = {log.user_id for log in logs}
    users = {u.id: u.username for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    items = []
    for log in logs:
        # Parse changes JSON
        changes = None
        if log.changes:
            try:
                changes = json.loads(log.changes)
            except json.JSONDecodeError:
                changes = None

        item = AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            entity_name=log.entity_name,
            project_id=log.project_id,
            changes=changes,
            created_at=log.created_at,
            username=users.get(log.user_id),
            ip_address=log.ip_address,
        )
        items.append(item)

    return AuditLogListResponse(items=items, total=total, next_cursor=next_cursor)


@router.get("/entity/{entity_type}/{entity_id}", response_model=List[AuditLogResponse])
def get_entity_audit_history(
    entity_type: str,
    entity_id: int,
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get audit history for a specific entity."""
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id)
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
        .all()
    )

    # Populate usernames
    user_ids = {log.user_id for log in logs}
    users = {u.id: u.username for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    items = []
    for log in logs:
        changes = None
        if log.changes:
            try:
                changes = json.loads(log.changes)
            except json.JSONDecodeError:
                changes = None

        item = AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            entity_name=log.entity_name,
            project_id=log.project_id,
            changes=changes,
            created_at=log.created_at,
            username=users.get(log.user_id),
            ip_address=log.ip_address,
        )
        items.append(item)

    return items
