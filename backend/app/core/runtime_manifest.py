"""Shared loader for the PyBatSim runtime manifest.

Single source of truth used by:
- GET /system/runtime endpoint (exposes the manifest to the UI)
- strategy_validator (whitelists imports at upload time)

Manifest file: docker/pybatsim-extended/runtime-info.json. Resolved via several
anchors so the backend finds it regardless of CWD.
"""
import json
import logging
import os
import sys
from functools import lru_cache
from typing import Iterable

from app.core.config import settings

logger = logging.getLogger(__name__)


class ManifestLoadError(Exception):
    """Manifest file missing or unreadable. Endpoint maps to HTTP 503."""

    def __init__(self, message: str, tried: list[str], cause: str | None = None) -> None:
        super().__init__(message)
        self.tried = tried
        self.cause = cause


def _candidate_manifest_paths(configured: str) -> list[str]:
    """Try the configured path under several anchors so backend resolves it regardless of CWD.

    Anchors: configured value as-is, CWD, backend dir (parent of app/), repo root (../ from backend/).
    """
    here = os.path.dirname(os.path.abspath(__file__))  # .../backend/app/core
    backend_dir = os.path.abspath(os.path.join(here, "..", ".."))  # .../backend
    repo_root = os.path.abspath(os.path.join(backend_dir, ".."))   # batsim-web-portal/
    # removeprefix (not lstrip) — lstrip treats the arg as a char set and would also
    # eat a leading literal `.` from a hidden-prefix path like `.config/runtime-info.json`.
    stripped = configured.removeprefix("./").removeprefix(".\\")
    return [
        configured,
        os.path.abspath(configured),
        os.path.join(os.getcwd(), stripped),
        os.path.join(backend_dir, stripped),
        os.path.join(repo_root, stripped),
    ]


@lru_cache(maxsize=1)
def load_runtime_manifest() -> dict:
    """Read docker/pybatsim-extended/runtime-info.json once and cache the result.

    Raises ManifestLoadError if file missing or unreadable. Callers decide how to
    surface the error (HTTP 503 for the endpoint, fallback whitelist for the validator).
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
                raise ManifestLoadError(
                    f"Runtime manifest at {candidate} is unreadable",
                    tried=tried,
                    cause=str(exc),
                ) from exc
    raise ManifestLoadError(
        "Runtime manifest file not found — build the extended PyBatSim image first.",
        tried=tried,
    )


# Defensive-floor allow-list — modules the validator should always accept even when
# the manifest file is unreachable. Two categories:
#   1. Simulator API (batsim, pybatsim) — defined by the system contract, not the image.
#   2. Upstream-image transitive deps (procset, sortedcontainers) — shipped by
#      `tanaxer/pybatsim:latest` regardless of whether the extended image was built.
#
# sortedcontainers is also pinned in the extended manifest (so the UI banner advertises
# its exact version). The dupe is intentional: the manifest is the human-facing catalogue
# and may go stale; this set is the hardcoded floor that keeps the validator usable in dev.
_BASE_ALLOWED: frozenset[str] = frozenset({"batsim", "pybatsim", "procset", "sortedcontainers"})


def _normalize_module_name(name: str) -> str:
    """pip package names allow `-` but Python imports use `_`. Normalize for comparison."""
    return name.strip().lower().replace("-", "_")


def get_allowed_top_level_modules() -> set[str]:
    """Return the set of top-level module names a strategy may import.

    Composed from: stdlib (sys.stdlib_module_names) + base whitelist (batsim/pybatsim)
    + libs declared in runtime-info.json. If the manifest is unreachable we fall back
    to stdlib + base so validation still works in dev (logged as a warning).
    """
    allowed: set[str] = set()
    allowed.update(_normalize_module_name(m) for m in sys.stdlib_module_names)
    allowed.update(_BASE_ALLOWED)
    try:
        manifest = load_runtime_manifest()
        libs: Iterable[dict] = manifest.get("available_libs", []) or []
        for lib in libs:
            name = lib.get("name")
            if isinstance(name, str) and name:
                allowed.add(_normalize_module_name(name))
    except ManifestLoadError as exc:
        logger.warning(
            "Runtime manifest unavailable for validator whitelist (%s); "
            "strategies importing numpy/scipy/etc. will be rejected until the manifest is built.",
            exc,
        )
    return allowed
