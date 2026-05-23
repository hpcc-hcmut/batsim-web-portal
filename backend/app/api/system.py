"""System API endpoints — health, config, and monitoring info."""

import json
import logging
import os
from functools import lru_cache

from fastapi import APIRouter, Depends
from app.core.config import settings
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


# Fallback used when the runtime-info.json file is missing (e.g. running backend
# outside the repo). Keeps the API contract stable for the frontend.
_RUNTIME_FALLBACK = {
    "image": settings.PYBATSIM_IMAGE,
    "base_image": "tanaxer/pybatsim:latest",
    "python_version": "3.10",
    "pybatsim_version": "4.x",
    "available_libs": [],
    "policy": "Runtime manifest file not found — operator must build the extended image (see docker/pybatsim-extended/README.md).",
}


def _candidate_manifest_paths(configured: str) -> list[str]:
    """Try the configured path under several anchors so backend resolves it regardless of CWD.

    Anchors: configured value as-is, CWD, backend dir (parent of app/), repo root (../ from backend/).
    """
    here = os.path.dirname(os.path.abspath(__file__))  # .../backend/app/api
    backend_dir = os.path.abspath(os.path.join(here, "..", ".."))  # .../backend
    repo_root = os.path.abspath(os.path.join(backend_dir, ".."))   # batsim-web-portal/
    stripped = configured.lstrip("./").lstrip(".\\")
    return [
        configured,
        os.path.abspath(configured),
        os.path.join(os.getcwd(), stripped),
        os.path.join(backend_dir, stripped),
        os.path.join(repo_root, stripped),
    ]


@lru_cache(maxsize=1)
def _load_runtime_manifest() -> dict:
    """Read docker/pybatsim-extended/runtime-info.json once and cache the result."""
    for candidate in _candidate_manifest_paths(settings.PYBATSIM_RUNTIME_INFO_PATH):
        if candidate and os.path.exists(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (OSError, json.JSONDecodeError) as exc:
                logger.warning("Failed to read runtime manifest at %s: %s", candidate, exc)
                break
    return _RUNTIME_FALLBACK


@router.get("/runtime")
def get_runtime_info(current_user: User = Depends(get_current_user)):
    """Surface the PyBatSim container's runtime manifest to the frontend.

    Frontend uses this on the Strategy upload page to display "Available libraries: ..." banner,
    so users discover allowed imports before hitting an ImportError at simulation start.
    """
    return _load_runtime_manifest()
