"""System API endpoints — health, config, and monitoring info."""

import json
import logging
import os
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException
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


class _ManifestLoadError(Exception):
    """Internal signal: manifest file missing or unreadable. Endpoint maps to HTTP 503."""

    def __init__(self, message: str, tried: list[str], cause: str | None = None) -> None:
        super().__init__(message)
        self.tried = tried
        self.cause = cause


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
    """Read docker/pybatsim-extended/runtime-info.json once and cache the result.

    Raises _ManifestLoadError if file missing or unreadable — endpoint maps to HTTP 503
    so the UI shows a clear actionable message instead of silently rendering empty libs.
    """
    tried: list[str] = []
    for candidate in _candidate_manifest_paths(settings.PYBATSIM_RUNTIME_INFO_PATH):
        if not candidate:
            continue
        tried.append(candidate)
        if os.path.exists(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (OSError, json.JSONDecodeError) as exc:
                logger.warning("Failed to read runtime manifest at %s: %s", candidate, exc)
                raise _ManifestLoadError(
                    f"Runtime manifest at {candidate} is unreadable",
                    tried=tried,
                    cause=str(exc),
                ) from exc
    raise _ManifestLoadError(
        "Runtime manifest file not found — build the extended PyBatSim image first.",
        tried=tried,
    )


@router.get("/runtime")
def get_runtime_info(current_user: User = Depends(get_current_user)):
    """Surface the PyBatSim container's runtime manifest to the frontend.

    Frontend uses this on the Strategy upload page to display "Available libraries: ..." banner,
    so users discover allowed imports before hitting an ImportError at simulation start.

    Returns 503 with a structured error when the manifest is missing/unreadable so the
    operator gets an actionable message instead of a misleading empty libs list.
    """
    try:
        return _load_runtime_manifest()
    except _ManifestLoadError as exc:
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
