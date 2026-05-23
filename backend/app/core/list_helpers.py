"""Shared helpers for list endpoints: safe sort + total count header.

Used by entity list endpoints (workloads, platforms, strategies, scenarios,
experiments, results) to expose URL-driven sort + pagination.
"""
from typing import Type, Iterable
from fastapi import HTTPException, Response
from sqlalchemy.orm import Query


def apply_sort(
    query: Query,
    model: Type,
    sort_by: str,
    order: str,
    allowed: Iterable[str],
    default: str = "created_at",
) -> Query:
    """Apply order_by safely. Raise 400 if sort_by is not whitelisted."""
    allowed_set = set(allowed)
    if sort_by not in allowed_set:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort_by '{sort_by}'. Allowed: {sorted(allowed_set)}",
        )
    if order not in ("asc", "desc"):
        raise HTTPException(
            status_code=400, detail="order must be 'asc' or 'desc'"
        )
    col = getattr(model, sort_by, None)
    if col is None:
        col = getattr(model, default)
    return query.order_by(col.desc() if order == "desc" else col.asc())


def set_total_count(response: Response, total: int) -> None:
    """Set X-Total-Count header for pagination clients."""
    response.headers["X-Total-Count"] = str(total)
