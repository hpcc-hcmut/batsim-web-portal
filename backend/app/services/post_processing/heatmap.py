"""Host x Time utilization heatmap aggregated from BatSim's out_jobs.csv.

Server-side aggregation on purpose: the Replay timeline endpoint truncates the
per-job list for big runs (density mode), and a heatmap rasterized client-side
from a truncated list would under-report host busyness. Aggregating here uses
EVERY job and ships only n_hosts x buckets floats.

Public entry: `derive_host_utilization_heatmap(jobs_csv, n_hosts_hint, buckets)`.
"""
import csv
import io
import logging
from typing import Any, Dict, List, Optional

from .timeline import _row_to_timeline_job

logger = logging.getLogger(__name__)


def derive_host_utilization_heatmap(
    jobs_csv: str,
    n_hosts_hint: Optional[int] = None,
    buckets: int = 240,
) -> Dict[str, Any]:
    """Aggregate busy fraction per (host, time bucket).

    rows[host][bucket] = fraction of that bucket's wall time the host spent
    running jobs (0..1). Buckets evenly divide [t0, t1] where t0 = earliest
    submission and t1 = latest finish.

    Cost is bounded: total cell updates ~= utilization * n_hosts * buckets,
    independent of job count - safe for 50k-job runs.
    """
    reader = csv.DictReader(io.StringIO(jobs_csv))
    jobs: List[Dict[str, Any]] = [
        _row_to_timeline_job(row, idx) for idx, row in enumerate(reader)
    ]

    # Host count: trust the platform hint, fall back to max allocated id + 1
    n_hosts = n_hosts_hint or 0
    if not n_hosts:
        max_host = -1
        for j in jobs:
            for h in j["allocated_resources"]:
                if h > max_host:
                    max_host = h
        n_hosts = max_host + 1 if max_host >= 0 else 0

    empty = {
        "n_hosts": n_hosts,
        "buckets": buckets,
        "t0": 0.0,
        "t1": 0.0,
        "rows": [],
    }
    if not jobs or n_hosts <= 0:
        return empty

    starts = [j["starting_time"] for j in jobs if j["starting_time"] is not None]
    finishes = [j["finish_time"] for j in jobs if j["finish_time"] is not None]
    submits = [j["submission_time"] for j in jobs]
    if not finishes or not starts:
        return empty

    t0 = min(min(submits), min(starts))
    t1 = max(finishes)
    span = t1 - t0
    if span <= 0:
        return empty

    bucket_w = span / buckets
    rows: List[List[float]] = [[0.0] * buckets for _ in range(n_hosts)]

    for j in jobs:
        start, finish = j["starting_time"], j["finish_time"]
        if start is None or finish is None or finish <= start:
            continue
        b_first = max(0, int((start - t0) / bucket_w))
        b_last = min(buckets - 1, int((finish - t0) / bucket_w))
        for h in j["allocated_resources"]:
            if h >= n_hosts:
                continue  # malformed allocation beyond platform size
            row = rows[h]
            for b in range(b_first, b_last + 1):
                lo = t0 + b * bucket_w
                hi = lo + bucket_w
                overlap = min(finish, hi) - max(start, lo)
                if overlap > 0:
                    row[b] += overlap

    # Normalize to busy fraction; clamp guards float drift on bucket edges
    for h in range(n_hosts):
        row = rows[h]
        for b in range(buckets):
            row[b] = round(min(row[b] / bucket_w, 1.0), 3)

    return {
        "n_hosts": n_hosts,
        "buckets": buckets,
        "t0": round(t0, 4),
        "t1": round(t1, 4),
        "rows": rows,
    }
