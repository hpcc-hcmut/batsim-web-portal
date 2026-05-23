"""Helpers for working with workload jobs JSON without dumping full payload to API responses.

Workload.jobs is stored as JSON TEXT (BatSim format). For workloads with thousands of
jobs we never want to ship the full blob to the UI. These helpers parse once and provide
aggregate stats + paginated slices.
"""
import json
from functools import lru_cache
from typing import Any, Dict, List, Tuple


def _safe_parse(jobs_text: str | None, profiles_text: str | None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Parse workload jobs + profiles JSON. Returns ([], {}) on empty/invalid input."""
    jobs: List[Dict[str, Any]] = []
    profiles: Dict[str, Any] = {}
    if jobs_text:
        try:
            parsed = json.loads(jobs_text)
            if isinstance(parsed, list):
                jobs = parsed
        except (json.JSONDecodeError, TypeError):
            pass
    if profiles_text:
        try:
            parsed = json.loads(profiles_text)
            if isinstance(parsed, dict):
                profiles = parsed
        except (json.JSONDecodeError, TypeError):
            pass
    return jobs, profiles


@lru_cache(maxsize=32)
def _parse_cached(jobs_text_hash: str, jobs_text: str | None, profiles_text: str | None):
    # The hash arg makes the LRU cache key explicit (in case jobs_text is huge);
    # callers pass a short stable digest so we don't keep many MB strings as keys.
    return _safe_parse(jobs_text, profiles_text)


def parse_workload_payload(jobs_text: str | None, profiles_text: str | None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Public entry — parses with a small LRU cache. For lab-scale, simple hash key is enough."""
    digest_key = f"{len(jobs_text or '')}:{len(profiles_text or '')}"
    return _parse_cached(digest_key, jobs_text, profiles_text)


def compute_summary(jobs: List[Dict[str, Any]], profiles: Dict[str, Any]) -> Dict[str, Any]:
    """Aggregate stats over jobs list. All fields optional — None if jobs missing."""
    n_jobs = len(jobs)
    if n_jobs == 0:
        return {
            "n_jobs": 0,
            "n_profiles": len(profiles),
            "min_walltime": None,
            "max_walltime": None,
            "mean_walltime": None,
            "total_walltime": None,
            "min_res": None,
            "max_res": None,
            "earliest_subtime": None,
            "latest_subtime": None,
        }

    walltimes: List[float] = []
    res_counts: List[int] = []
    subtimes: List[float] = []
    for j in jobs:
        wt = j.get("walltime")
        if isinstance(wt, (int, float)) and wt > 0:
            walltimes.append(float(wt))
        r = j.get("res")
        if isinstance(r, int) and r > 0:
            res_counts.append(r)
        st = j.get("subtime")
        if isinstance(st, (int, float)) and st >= 0:
            subtimes.append(float(st))

    return {
        "n_jobs": n_jobs,
        "n_profiles": len(profiles),
        "min_walltime": min(walltimes) if walltimes else None,
        "max_walltime": max(walltimes) if walltimes else None,
        "mean_walltime": round(sum(walltimes) / len(walltimes), 4) if walltimes else None,
        "total_walltime": round(sum(walltimes), 4) if walltimes else None,
        "min_res": min(res_counts) if res_counts else None,
        "max_res": max(res_counts) if res_counts else None,
        "earliest_subtime": min(subtimes) if subtimes else None,
        "latest_subtime": max(subtimes) if subtimes else None,
    }


def slice_jobs(jobs: List[Dict[str, Any]], offset: int, limit: int) -> List[Dict[str, Any]]:
    """Safe slice for paginated jobs preview endpoint."""
    if offset < 0:
        offset = 0
    if limit < 1:
        limit = 1
    if limit > 500:
        limit = 500
    return jobs[offset:offset + limit]
