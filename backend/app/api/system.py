"""System API endpoints — health, config, and monitoring info."""

from fastapi import APIRouter, Depends
from app.core.config import settings
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/")
def get_system_status():
    return {"status": "healthy"}


@router.get("/config")
def get_public_config(current_user: User = Depends(get_current_user)):
    """Return public configuration values needed by the frontend."""
    return {
        "grafana_url": settings.GRAFANA_URL,
        "max_concurrent_simulations": settings.MAX_CONCURRENT_SIMULATIONS,
        "simulation_timeout_seconds": settings.SIMULATION_TIMEOUT_SECONDS,
    }
