"""Prometheus metrics services for BatSim Web Portal."""

from app.services.metrics.metrics_exporter import setup_metrics, get_metrics_app
from app.services.metrics.container_stats_collector import ContainerStatsCollector

__all__ = ["setup_metrics", "get_metrics_app", "ContainerStatsCollector",
           "set_stats_collector", "get_stats_collector"]

# Module-level singleton — set once by main.py, read by orchestrator (avoids circular import)
_collector_instance = None


def set_stats_collector(c) -> None:
    """Store the singleton ContainerStatsCollector created at startup."""
    global _collector_instance
    _collector_instance = c


def get_stats_collector():
    """Return the singleton ContainerStatsCollector, or None if not yet initialised."""
    return _collector_instance
