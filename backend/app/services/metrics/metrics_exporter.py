"""Prometheus metrics exporter for BatSim Web Portal.

Exposes custom metrics about experiment lifecycle, simulation progress,
and queue status. Mounted as a WSGI sub-app at /metrics.
"""

import logging

from prometheus_client import (
    CollectorRegistry,
    Gauge,
    Counter,
    Histogram,
    make_wsgi_app,
)

logger = logging.getLogger(__name__)

# Dedicated registry (avoids default process/gc collectors cluttering output)
REGISTRY = CollectorRegistry()

# --- Experiment lifecycle metrics ---

experiment_status = Gauge(
    "batsim_experiment_status",
    "Current experiment status (1=active for that status label)",
    ["experiment_id", "status"],
    registry=REGISTRY,
)

experiment_progress = Gauge(
    "batsim_experiment_progress_percent",
    "Experiment progress percentage (0-100)",
    ["experiment_id"],
    registry=REGISTRY,
)

experiment_jobs_total = Gauge(
    "batsim_experiment_jobs_total",
    "Total jobs in experiment",
    ["experiment_id"],
    registry=REGISTRY,
)

experiment_jobs_completed = Gauge(
    "batsim_experiment_jobs_completed",
    "Completed jobs in experiment",
    ["experiment_id"],
    registry=REGISTRY,
)

# --- Queue metrics ---

queue_size = Gauge(
    "batsim_queue_size",
    "Number of experiments in queue (by status)",
    ["status"],
    registry=REGISTRY,
)

active_experiments = Gauge(
    "batsim_active_experiments",
    "Number of currently running experiments",
    registry=REGISTRY,
)

# --- Aggregate counters ---

experiments_started_total = Counter(
    "batsim_experiments_started_total",
    "Total experiments started since server boot",
    registry=REGISTRY,
)

experiments_completed_total = Counter(
    "batsim_experiments_completed_total",
    "Total experiments completed since server boot",
    registry=REGISTRY,
)

experiments_failed_total = Counter(
    "batsim_experiments_failed_total",
    "Total experiments failed since server boot",
    registry=REGISTRY,
)

# --- Duration histogram ---

experiment_duration_seconds = Histogram(
    "batsim_experiment_duration_seconds",
    "Experiment duration from start to end",
    ["experiment_id"],
    buckets=[10, 30, 60, 120, 300, 600, 1800, 3600],
    registry=REGISTRY,
)

# --- Container resource metrics (populated by container_stats_collector) ---

container_cpu_percent = Gauge(
    "batsim_container_cpu_percent",
    "Container CPU usage percentage",
    ["experiment_id", "container_type"],
    registry=REGISTRY,
)

container_memory_bytes = Gauge(
    "batsim_container_memory_bytes",
    "Container memory usage in bytes",
    ["experiment_id", "container_type"],
    registry=REGISTRY,
)

container_memory_limit_bytes = Gauge(
    "batsim_container_memory_limit_bytes",
    "Container memory limit in bytes",
    ["experiment_id", "container_type"],
    registry=REGISTRY,
)

# --- Live progress metrics (populated by progress_parser thread, Task 7.5) ---

live_jobs_submitted = Gauge(
    "batsim_live_jobs_submitted",
    "Jobs submitted so far in this running experiment",
    ["experiment_id"],
    registry=REGISTRY,
)

live_jobs_completed = Gauge(
    "batsim_live_jobs_completed",
    "Jobs completed so far in this running experiment",
    ["experiment_id"],
    registry=REGISTRY,
)

live_jobs_running = Gauge(
    "batsim_live_jobs_running",
    "Jobs currently in flight (submitted - completed - failed)",
    ["experiment_id"],
    registry=REGISTRY,
)

live_jobs_failed = Gauge(
    "batsim_live_jobs_failed",
    "Jobs killed/timeouted/failed so far in this running experiment",
    ["experiment_id"],
    registry=REGISTRY,
)

last_sim_time_seconds = Gauge(
    "batsim_last_sim_time_seconds",
    "Most recent simulation-time observed in batsim_stdout",
    ["experiment_id"],
    registry=REGISTRY,
)


def get_metrics_app():
    """Return a WSGI app that serves /metrics for Prometheus scraping."""
    return make_wsgi_app(REGISTRY)


def setup_metrics():
    """Initialize metrics (called once at startup)."""
    logger.info("[Metrics] Prometheus metrics exporter initialized")


def update_experiment_metrics(db_session):
    """Refresh all experiment metrics from current DB state.

    Called by the metrics middleware before each /metrics scrape to ensure
    Prometheus always gets fresh data. Uses build-then-swap to avoid
    partial reads during concurrent Prometheus scrapes.
    """
    from app.models.experiment import Experiment, ExperimentStatus

    try:
        experiments = db_session.query(Experiment).all()

        # Build new metric snapshots before swapping (thread-safe)
        new_status = {}
        new_progress = {}
        new_jobs_total = {}
        new_jobs_completed = {}
        status_counts = {}

        for exp in experiments:
            eid = str(exp.id)
            status_val = exp.status.value if hasattr(exp.status, "value") else str(exp.status)

            new_status[(eid, status_val)] = 1
            new_progress[(eid,)] = exp.progress_percentage or 0
            new_jobs_total[(eid,)] = exp.total_jobs or 0
            new_jobs_completed[(eid,)] = exp.completed_jobs or 0
            status_counts[status_val] = status_counts.get(status_val, 0) + 1

        # Atomic swap: clear + repopulate per-experiment gauges
        experiment_status._metrics.clear()
        for (eid, status_val), val in new_status.items():
            experiment_status.labels(experiment_id=eid, status=status_val).set(val)

        experiment_progress._metrics.clear()
        for (eid,), val in new_progress.items():
            experiment_progress.labels(experiment_id=eid).set(val)

        experiment_jobs_total._metrics.clear()
        for (eid,), val in new_jobs_total.items():
            experiment_jobs_total.labels(experiment_id=eid).set(val)

        experiment_jobs_completed._metrics.clear()
        for (eid,), val in new_jobs_completed.items():
            experiment_jobs_completed.labels(experiment_id=eid).set(val)

        # Queue metrics
        queue_size._metrics.clear()
        for status_val, count in status_counts.items():
            queue_size.labels(status=status_val).set(count)

        active_experiments.set(status_counts.get("running", 0))

    except Exception as e:
        logger.warning(f"[Metrics] Failed to update experiment metrics: {e}")
