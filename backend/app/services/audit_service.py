import json
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)

# Fields to mask in audit logs (PII protection)
MASKED_FIELDS = {"password", "hashed_password", "token", "api_key", "secret", "credit_card"}


def mask_sensitive_data(changes: Dict[str, Any]) -> Dict[str, Any]:
    """Mask sensitive fields before storing in audit log."""
    if not changes:
        return changes
    masked = {}
    for key, value in changes.items():
        if key.lower() in MASKED_FIELDS:
            masked[key] = {"old": "***", "new": "***"} if isinstance(value, dict) else "***"
        elif isinstance(value, dict):
            masked[key] = mask_sensitive_data(value)
        else:
            masked[key] = value
    return masked


def compute_changes(old_dict: Dict, new_dict: Dict) -> Dict[str, Dict]:
    """Compute field-level changes between old and new state."""
    changes = {}
    all_keys = set(old_dict.keys()) | set(new_dict.keys())
    for key in all_keys:
        # Skip internal fields
        if key.startswith("_"):
            continue
        old_val = old_dict.get(key)
        new_val = new_dict.get(key)
        # Convert datetime to string for comparison
        if hasattr(old_val, "isoformat"):
            old_val = old_val.isoformat()
        if hasattr(new_val, "isoformat"):
            new_val = new_val.isoformat()
        if old_val != new_val:
            changes[key] = {"old": old_val, "new": new_val}
    return mask_sensitive_data(changes)


def log_audit(
    db: Session,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: int,
    entity_name: Optional[str] = None,
    project_id: Optional[int] = None,
    changes: Optional[Dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """Create an audit log entry synchronously."""
    # Mask any sensitive data in changes
    if changes:
        changes = mask_sensitive_data(changes)

    audit = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        project_id=project_id,
        changes=json.dumps(changes) if changes else None,
        ip_address=ip_address,
        user_agent=user_agent[:255] if user_agent else None,
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    logger.info(f"Audit: {action} {entity_type}:{entity_id} by user:{user_id}")
    return audit


def log_audit_async(
    db: Session,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: int,
    entity_name: Optional[str] = None,
    project_id: Optional[int] = None,
    changes: Optional[Dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Create an audit log entry (designed for background task usage)."""
    try:
        log_audit(
            db=db,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            project_id=project_id,
            changes=changes,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except Exception as e:
        logger.error(f"Audit logging failed: {e}")
