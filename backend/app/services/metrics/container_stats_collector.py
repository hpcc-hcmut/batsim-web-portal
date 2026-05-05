"""Docker container stats collector using Docker SDK.

Lightweight replacement for cAdvisor — polls container.stats() for running
experiment containers and updates Prometheus gauges.
"""

import logging
import threading
import time

import docker
from docker.errors import APIError, NotFound

from app.core.config import settings
from app.services.metrics.metrics_exporter import (
    container_cpu_percent,
    container_memory_bytes,
    container_memory_limit_bytes,
)

logger = logging.getLogger(__name__)

# Label used to identify experiment containers
APP_LABEL = "batsim-web-portal"


class ContainerStatsCollector:
    """Background thread that polls Docker container stats for Prometheus."""

    def __init__(self):
        self._thread = None
        self._stop_event = threading.Event()
        self._client = None
        # Tracks last-seen timestamp per (experiment_id, container_type) key
        self._last_seen: dict[tuple[str, str], float] = {}

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
            self._stop_event.wait(timeout=settings.STATS_POLL_INTERVAL_SECONDS)

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

        # Update last-seen timestamps for keys observed this cycle
        now = time.time()
        for key in seen:
            self._last_seen[key] = now

        # Evict keys not seen for STATS_KEY_TTL_SECONDS (time-based, not immediate)
        # This preserves the final gauge value long enough for Prometheus to scrape it
        ttl = settings.STATS_KEY_TTL_SECONDS
        expired = [k for k, t in self._last_seen.items() if now - t > ttl]
        for key in expired:
            container_cpu_percent._metrics.pop(key, None)
            container_memory_bytes._metrics.pop(key, None)
            container_memory_limit_bytes._metrics.pop(key, None)
            self._last_seen.pop(key, None)

    def emit_snapshot_for(
        self, container, experiment_id: int, container_type: str
    ) -> None:
        """Emit a single synchronous stats snapshot for a (possibly stopped) container.

        Called from the orchestrator finally block BEFORE cleanup() removes the container.
        Ensures at least one gauge sample exists even for sub-second simulations.
        """
        try:
            exp_id = str(experiment_id)
            stats = container.stats(stream=False)
            cpu_pct = self._calc_cpu_percent(stats)
            mem_usage = stats.get("memory_stats", {}).get("usage", 0)
            mem_limit = stats.get("memory_stats", {}).get("limit", 0)

            container_cpu_percent.labels(
                experiment_id=exp_id, container_type=container_type
            ).set(cpu_pct)
            container_memory_bytes.labels(
                experiment_id=exp_id, container_type=container_type
            ).set(mem_usage)
            container_memory_limit_bytes.labels(
                experiment_id=exp_id, container_type=container_type
            ).set(mem_limit)

            # Refresh TTL so the time-based eviction doesn't immediately clear it
            self._last_seen[(exp_id, container_type)] = time.time()
            logger.debug(
                f"[Stats] Final snapshot emitted for exp={exp_id} type={container_type} "
                f"cpu={cpu_pct}% mem={mem_usage}"
            )
        except (NotFound, APIError, KeyError) as e:
            logger.debug(f"[Stats] Final snapshot skipped for exp={experiment_id}: {e}")

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
