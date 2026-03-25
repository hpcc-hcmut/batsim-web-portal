"""Docker container stats collector using Docker SDK.

Lightweight replacement for cAdvisor — polls container.stats() for running
experiment containers and updates Prometheus gauges.
"""

import logging
import threading
import time

import docker
from docker.errors import APIError, NotFound

from app.services.metrics.metrics_exporter import (
    container_cpu_percent,
    container_memory_bytes,
    container_memory_limit_bytes,
)

logger = logging.getLogger(__name__)

# Label used to identify experiment containers
APP_LABEL = "batsim-web-portal"

# Poll interval in seconds
STATS_POLL_INTERVAL = 5


class ContainerStatsCollector:
    """Background thread that polls Docker container stats for Prometheus."""

    def __init__(self):
        self._thread = None
        self._stop_event = threading.Event()
        self._client = None

    def start(self):
        """Start the background polling thread."""
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._poll_loop,
            name="container-stats-collector",
            daemon=True,
        )
        self._thread.start()
        logger.info("[Stats] Container stats collector started")

    def stop(self):
        """Signal the polling thread to stop."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=10)
        logger.info("[Stats] Container stats collector stopped")

    def _poll_loop(self):
        """Main polling loop — runs until stop_event is set."""
        while not self._stop_event.is_set():
            try:
                self._collect_stats()
            except Exception as e:
                logger.debug(f"[Stats] Collection cycle error: {e}")
            self._stop_event.wait(timeout=STATS_POLL_INTERVAL)

    def _get_client(self):
        """Get or create a reusable Docker client."""
        if self._client is None:
            self._client = docker.from_env()
        return self._client

    def _collect_stats(self):
        """Poll stats for all running experiment containers."""
        try:
            client = self._get_client()
        except Exception:
            self._client = None  # Reset on failure so next cycle retries
            return

        try:
            containers = client.containers.list(
                filters={"label": APP_LABEL, "status": "running"}
            )
        except APIError:
            return

        # Track which experiment_ids we've seen this cycle
        seen = set()

        for container in containers:
            try:
                exp_id = container.labels.get(APP_LABEL, "unknown")
                # Determine container type from name
                name = container.name or ""
                if "pybatsim" in name:
                    ctype = "pybatsim"
                elif "batsim" in name:
                    ctype = "batsim"
                else:
                    ctype = "unknown"

                # stream=False gives a single snapshot (not a blocking stream)
                stats = container.stats(stream=False)
                cpu_pct = self._calc_cpu_percent(stats)
                mem_usage = stats.get("memory_stats", {}).get("usage", 0)
                mem_limit = stats.get("memory_stats", {}).get("limit", 0)

                container_cpu_percent.labels(
                    experiment_id=exp_id, container_type=ctype
                ).set(cpu_pct)
                container_memory_bytes.labels(
                    experiment_id=exp_id, container_type=ctype
                ).set(mem_usage)
                container_memory_limit_bytes.labels(
                    experiment_id=exp_id, container_type=ctype
                ).set(mem_limit)

                seen.add((exp_id, ctype))

            except (NotFound, APIError, KeyError):
                continue

        # Clear metrics for containers no longer running
        stale_keys = [
            k for k in container_cpu_percent._metrics
            if k not in seen
        ]
        for key in stale_keys:
            container_cpu_percent._metrics.pop(key, None)
            container_memory_bytes._metrics.pop(key, None)
            container_memory_limit_bytes._metrics.pop(key, None)

    @staticmethod
    def _calc_cpu_percent(stats: dict) -> float:
        """Calculate CPU usage % from Docker stats snapshot."""
        cpu_stats = stats.get("cpu_stats", {})
        precpu_stats = stats.get("precpu_stats", {})

        cpu_total = cpu_stats.get("cpu_usage", {}).get("total_usage", 0)
        precpu_total = precpu_stats.get("cpu_usage", {}).get("total_usage", 0)
        system_total = cpu_stats.get("system_cpu_usage", 0)
        presystem_total = precpu_stats.get("system_cpu_usage", 0)

        cpu_delta = cpu_total - precpu_total
        system_delta = system_total - presystem_total

        if system_delta > 0 and cpu_delta >= 0:
            num_cpus = cpu_stats.get("online_cpus", 1) or 1
            return round((cpu_delta / system_delta) * num_cpus * 100.0, 2)
        return 0.0
