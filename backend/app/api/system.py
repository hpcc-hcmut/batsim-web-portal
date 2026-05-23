"""System API endpoints — health, config, and monitoring info."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from app.core.config import settings
from app.core.runtime_manifest import (
    ManifestLoadError,
    load_runtime_manifest,
)
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


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


@router.get("/runtime")
def get_runtime_info(current_user: User = Depends(get_current_user)):
    """Surface the PyBatSim container's runtime manifest to the frontend.

    Frontend uses this on the Strategy upload page to display "Available libraries: ..." banner,
    so users discover allowed imports before hitting an ImportError at simulation start.

    Returns 503 with a structured error when the manifest is missing/unreadable so the
    operator gets an actionable message instead of a misleading empty libs list.
    """
    try:
        return load_runtime_manifest()
    except ManifestLoadError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "runtime_manifest_unavailable",
                "message": str(exc),
                "configured_path": settings.PYBATSIM_RUNTIME_INFO_PATH,
                "tried_paths": exc.tried,
                "cause": exc.cause,
                "hint": (
                    "Build the extended PyBatSim image: "
                    "`docker build -t batsim-portal/pybatsim-extended:1.0 docker/pybatsim-extended/`. "
                    "Then ensure docker/pybatsim-extended/runtime-info.json is present in the repo."
                ),
            },
        )
