"""Docker container manager for BatSim/PyBatsim simulation containers.

Wraps Docker SDK to create networks, run containers, collect logs, and cleanup.
All Docker operations are synchronous (meant to run in a background thread).
"""

import logging
import os
import time

import docker
from docker.errors import APIError, ImageNotFound, NotFound
from requests.exceptions import ReadTimeout, ConnectionError as RequestsConnectionError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Label used to identify all containers/networks managed by this app
APP_LABEL = "batsim-web-portal"


class ContainerManager:
    """Manages Docker containers for a single experiment run."""

    def __init__(self, experiment_id: int):
        self.experiment_id = experiment_id
        self.prefix = f"batsim-exp-{experiment_id}"
        self.network_name = f"{self.prefix}-net"
        self.pybatsim_name = f"{self.prefix}-pybatsim"
        self.batsim_name = f"{self.prefix}-batsim"
        self.client = docker.from_env()
        self.network = None
        self.pybatsim_container = None
        self.batsim_container = None

    def create_network(self) -> str:
        """Create a bridge network for inter-container communication."""
        self.network = self.client.networks.create(
            name=self.network_name,
            driver="bridge",
            labels={APP_LABEL: str(self.experiment_id)},
        )
        logger.info(f"[Exp {self.experiment_id}] Network created: {self.network_name}")
        return self.network_name

    @staticmethod
    def _abs(path: str) -> str:
        """Resolve to absolute path with forward slashes (Docker on Windows)."""
        return os.path.abspath(path).replace("\\", "/")

    @staticmethod
    def _bind_source(path: str) -> str:
        """Resolve to a host-visible absolute path for use as a Docker bind source.

        When the orchestrator runs inside a container (DooD), paths under the
        container-side STORAGE_PATH (e.g. /app/storage/...) don't exist on the
        host filesystem and the host Docker daemon would auto-create empty
        directories instead of mounting our real data. If HOST_STORAGE_PATH is
        set, rewrite paths under STORAGE_PATH to the host-side prefix so the
        daemon mounts the correct directory.

        When HOST_STORAGE_PATH is unset (native/hybrid mode), behavior is
        identical to _abs() — paths are used as-is.
        """
        abs_path = os.path.abspath(path).replace("\\", "/")
        host_storage = os.environ.get("HOST_STORAGE_PATH", "").strip()
        if not host_storage:
            return abs_path
        container_prefix = os.path.abspath(settings.STORAGE_PATH).replace("\\", "/")
        if abs_path.startswith(container_prefix + "/") or abs_path == container_prefix:
            host_norm = host_storage.replace("\\", "/").rstrip("/")
            return host_norm + abs_path[len(container_prefix):]
        return abs_path

    def start_pybatsim(self, strategy_path: str, exp_dir: str) -> str:
        """Start PyBatsim container (BINDS tcp://*:28000 — must start first).

        Args:
            strategy_path: Host path to the strategy .py file
            exp_dir: Host path to the experiment directory (all frozen files live here)

        Returns:
            Container ID
        """
        abs_exp_dir = self._bind_source(exp_dir)
        strategy_filename = os.path.basename(strategy_path)

        self.pybatsim_container = self.client.containers.run(
            image=settings.PYBATSIM_IMAGE,
            name=self.pybatsim_name,
            command=[
                "/opt/venv/bin/pybatsim",
                f"/data/{strategy_filename}",
                "-s", "tcp://*:28000",
            ],
            detach=True,
            network=self.network_name,
            volumes={
                abs_exp_dir: {"bind": "/data", "mode": "ro"},
            },
            labels={APP_LABEL: str(self.experiment_id)},
        )
        logger.info(
            f"[Exp {self.experiment_id}] PyBatsim started: {self.pybatsim_container.short_id}"
        )
        return self.pybatsim_container.id

    def start_batsim(
        self, workload_path: str, platform_path: str, exp_dir: str
    ) -> str:
        """Start BatSim container (CONNECTS to PyBatsim — must start second).

        Args:
            workload_path: Host path to the workload .json file
            platform_path: Host path to the platform .xml file
            exp_dir: Host path to the experiment directory (for results output)

        Returns:
            Container ID
        """
        workload_filename = os.path.basename(workload_path)
        platform_filename = os.path.basename(platform_path)
        abs_exp_dir = self._bind_source(exp_dir)

        # BatSim image has batsim as ENTRYPOINT — pass args as list to handle spaces
        command = [
            "-p", f"/data/{platform_filename}",
            "-w", f"/data/{workload_filename}",
            "-e", "/data/out",
            "-s", f"tcp://{self.pybatsim_name}:28000",
        ]

        volumes = {
            abs_exp_dir: {"bind": "/data", "mode": "rw"},
        }

        self.batsim_container = self.client.containers.run(
            image=settings.BATSIM_IMAGE,
            name=self.batsim_name,
            command=command,
            detach=True,
            network=self.network_name,
            volumes=volumes,
            labels={APP_LABEL: str(self.experiment_id)},
        )
        logger.info(
            f"[Exp {self.experiment_id}] BatSim started: {self.batsim_container.short_id}"
        )
        return self.batsim_container.id

    def wait_for_completion(self, timeout: int | None = None) -> dict:
        """Wait for BatSim container to finish (it drives the simulation).

        Returns dict with 'batsim_exit' and 'pybatsim_exit' codes.
        """
        effective_timeout = timeout or settings.SIMULATION_TIMEOUT_SECONDS

        # BatSim drives the simulation — when it exits, simulation is done
        try:
            batsim_result = self.batsim_container.wait(timeout=effective_timeout)
        except (ReadTimeout, RequestsConnectionError):
            raise TimeoutError(f"Simulation timed out after {effective_timeout}s")
        batsim_exit = batsim_result.get("StatusCode", -1)

        # Give PyBatsim a moment to finish after BatSim disconnects
        try:
            pybatsim_result = self.pybatsim_container.wait(timeout=10)
            pybatsim_exit = pybatsim_result.get("StatusCode", -1)
        except Exception:
            pybatsim_exit = -1

        logger.info(
            f"[Exp {self.experiment_id}] Completed — "
            f"BatSim exit={batsim_exit}, PyBatsim exit={pybatsim_exit}"
        )
        return {"batsim_exit": batsim_exit, "pybatsim_exit": pybatsim_exit}

    def get_logs(self, container_type: str = "both", tail: int = 500) -> dict:
        """Fetch logs from containers.

        Args:
            container_type: "batsim", "pybatsim", or "both"
            tail: Number of lines to fetch (0 = all)

        Returns:
            Dict with 'batsim_logs' and/or 'pybatsim_logs' keys.
        """
        result = {}
        kwargs = {"tail": tail} if tail > 0 else {}

        if container_type in ("batsim", "both") and self.batsim_container:
            try:
                self.batsim_container.reload()
                result["batsim_logs"] = self.batsim_container.logs(**kwargs).decode(
                    "utf-8", errors="replace"
                )
            except (NotFound, APIError):
                result["batsim_logs"] = ""

        if container_type in ("pybatsim", "both") and self.pybatsim_container:
            try:
                self.pybatsim_container.reload()
                result["pybatsim_logs"] = self.pybatsim_container.logs(**kwargs).decode(
                    "utf-8", errors="replace"
                )
            except (NotFound, APIError):
                result["pybatsim_logs"] = ""

        return result

    def stop_containers(self):
        """Stop both containers gracefully."""
        for name, container in [
            ("BatSim", self.batsim_container),
            ("PyBatsim", self.pybatsim_container),
        ]:
            if container is None:
                continue
            try:
                container.reload()
                if container.status in ("running", "created"):
                    container.stop(timeout=10)
                    logger.info(f"[Exp {self.experiment_id}] {name} stopped")
            except (NotFound, APIError) as e:
                logger.warning(f"[Exp {self.experiment_id}] {name} stop failed: {e}")

    def cleanup(self):
        """Remove containers and network. Safe to call multiple times."""
        for name, container in [
            ("BatSim", self.batsim_container),
            ("PyBatsim", self.pybatsim_container),
        ]:
            if container is None:
                continue
            try:
                container.remove(force=True)
                logger.info(f"[Exp {self.experiment_id}] {name} container removed")
            except (NotFound, APIError):
                pass

        if self.network:
            try:
                self.network.reload()
                self.network.remove()
                logger.info(f"[Exp {self.experiment_id}] Network removed")
            except (NotFound, APIError):
                pass

        self.batsim_container = None
        self.pybatsim_container = None
        self.network = None


def cleanup_orphan_containers():
    """Find and remove any orphaned batsim-web-portal containers/networks.

    Called on app startup to clean up after crashes.
    """
    try:
        client = docker.from_env()
    except Exception as e:
        logger.warning(f"Docker not available for orphan cleanup: {e}")
        return

    # Remove orphan containers
    try:
        containers = client.containers.list(
            all=True, filters={"label": APP_LABEL}
        )
        for container in containers:
            try:
                container.remove(force=True)
                logger.info(f"Removed orphan container: {container.name}")
            except (NotFound, APIError):
                pass
    except APIError as e:
        logger.warning(f"Failed to list orphan containers: {e}")

    # Remove orphan networks
    try:
        networks = client.networks.list(filters={"label": APP_LABEL})
        for network in networks:
            try:
                network.remove()
                logger.info(f"Removed orphan network: {network.name}")
            except (NotFound, APIError):
                pass
    except APIError as e:
        logger.warning(f"Failed to list orphan networks: {e}")
