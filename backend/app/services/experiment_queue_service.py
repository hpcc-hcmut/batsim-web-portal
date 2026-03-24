"""Experiment queue service — manages state transitions and concurrency.

State machine:
  PENDING → QUEUED (user clicks Run)
  QUEUED → RUNNING (slot available, worker picks up)
  RUNNING → COMPLETED | FAILED | CANCELLED
  QUEUED → CANCELLED (user cancels before start)
"""

import logging
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.experiment import Experiment, ExperimentStatus

logger = logging.getLogger(__name__)

# Valid state transitions
VALID_TRANSITIONS: dict[ExperimentStatus, set[ExperimentStatus]] = {
    ExperimentStatus.PENDING: {ExperimentStatus.QUEUED, ExperimentStatus.CANCELLED},
    ExperimentStatus.QUEUED: {ExperimentStatus.RUNNING, ExperimentStatus.CANCELLED},
    ExperimentStatus.RUNNING: {
        ExperimentStatus.COMPLETED,
        ExperimentStatus.FAILED,
        ExperimentStatus.CANCELLED,
        ExperimentStatus.PAUSED,
    },
    ExperimentStatus.PAUSED: {ExperimentStatus.QUEUED, ExperimentStatus.CANCELLED},
    ExperimentStatus.COMPLETED: set(),
    ExperimentStatus.FAILED: {ExperimentStatus.QUEUED},  # allow retry
    ExperimentStatus.CANCELLED: {ExperimentStatus.QUEUED},  # allow re-queue
}


class InvalidTransitionError(Exception):
    """Raised when a state transition is not allowed."""
    pass


def validate_transition(current: ExperimentStatus, target: ExperimentStatus):
    """Validate that a state transition is allowed. Raises InvalidTransitionError."""
    allowed = VALID_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise InvalidTransitionError(
            f"Cannot transition from {current.value} to {target.value}. "
            f"Allowed: {', '.join(s.value for s in allowed) or 'none'}"
        )


def enqueue_experiment(db: Session, experiment_id: int) -> Experiment:
    """Transition experiment PENDING → QUEUED."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise ValueError(f"Experiment {experiment_id} not found")

    validate_transition(exp.status, ExperimentStatus.QUEUED)
    exp.status = ExperimentStatus.QUEUED
    db.commit()
    db.refresh(exp)
    logger.info(f"Experiment {experiment_id} enqueued")
    return exp


def cancel_experiment(db: Session, experiment_id: int) -> Experiment:
    """Cancel an experiment (from QUEUED or RUNNING)."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise ValueError(f"Experiment {experiment_id} not found")

    validate_transition(exp.status, ExperimentStatus.CANCELLED)
    exp.status = ExperimentStatus.CANCELLED
    db.commit()
    db.refresh(exp)
    logger.info(f"Experiment {experiment_id} cancelled")
    return exp


def get_queue_status(db: Session) -> dict:
    """Return current queue status: running count, queued count, max slots."""
    running = db.query(Experiment).filter(
        Experiment.status == ExperimentStatus.RUNNING
    ).count()
    queued = db.query(Experiment).filter(
        Experiment.status == ExperimentStatus.QUEUED
    ).count()
    return {
        "running": running,
        "queued": queued,
        "max_concurrent": settings.MAX_CONCURRENT_SIMULATIONS,
        "available_slots": max(0, settings.MAX_CONCURRENT_SIMULATIONS - running),
    }


def process_queue(db: Session) -> list[int]:
    """Check queue and promote QUEUED → RUNNING if slots available.

    Returns list of experiment IDs that were promoted.
    Called by background task or manually after status changes.
    Uses SELECT ... FOR UPDATE to prevent race conditions (PostgreSQL).
    For SQLite (single-writer), the serialized writes provide safety.
    """
    running_count = db.query(Experiment).filter(
        Experiment.status == ExperimentStatus.RUNNING
    ).count()

    available = settings.MAX_CONCURRENT_SIMULATIONS - running_count
    if available <= 0:
        return []

    # Pick oldest queued experiments with row lock
    queued = (
        db.query(Experiment)
        .filter(Experiment.status == ExperimentStatus.QUEUED)
        .order_by(Experiment.created_at.asc())
        .limit(available)
        .with_for_update(skip_locked=True)
        .all()
    )

    promoted = []
    for exp in queued:
        exp.status = ExperimentStatus.RUNNING
        promoted.append(exp.id)
        logger.info(f"Experiment {exp.id} promoted QUEUED → RUNNING")

    if promoted:
        db.commit()

    return promoted
