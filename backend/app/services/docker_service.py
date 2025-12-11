"""
Docker Service - Container Lifecycle Management

Manages BatSim and PyBatsim container orchestration including:
- Network creation and management
- Container spawning with proper volume mounts
- Log streaming
- Graceful shutdown and cleanup
"""

import asyncio
import atexit
import logging
import signal
import sys
from dataclasses import dataclass, field
from typing import AsyncIterator, Callable, Optional, Dict, Any
from datetime import datetime

import docker
from docker.models.containers import Container
from docker.models.networks import Network
from docker.errors import NotFound, APIError, DockerException

from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)


@dataclass
class ContainerPair:
    """Holds references to BatSim and PyBatsim containers for an experiment."""
    batsim: Optional[Container] = None
    pybatsim: Optional[Container] = None
    network_name: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ContainerStats:
    """Container resource statistics."""
    cpu_percent: float = 0.0
    memory_usage_mb: float = 0.0
    memory_limit_mb: float = 0.0
    memory_percent: float = 0.0


class DockerService:
    """
    Manages Docker container lifecycle for BatSim simulations.

    Features:
    - Creates isolated Docker networks per experiment
    - Spawns BatSim simulator containers
    - Spawns PyBatsim scheduler containers
    - Streams container logs in real-time
    - Handles graceful cleanup on shutdown
    """

    def __init__(self):
        """Initialize Docker client and set up cleanup handlers."""
        self._client: Optional[docker.DockerClient] = None
        self._initialized = False
        self.network_prefix = "batsim-net"
        self.active_containers: Dict[int, ContainerPair] = {}
        self._cleanup_registered = False

    @property
    def client(self) -> docker.DockerClient:
        """Lazy initialization of Docker client."""
        if self._client is None:
            try:
                self._client = docker.from_env()
                self._client.ping()
                self._initialized = True
                logger.info("Docker client initialized successfully")
            except DockerException as e:
                logger.error(f"Failed to initialize Docker client: {e}")
                raise RuntimeError(
                    "Docker daemon is not available. "
                    "Please ensure Docker is running."
                ) from e
        return self._client

    def _setup_cleanup_handlers(self) -> None:
        """Register cleanup handlers for graceful shutdown."""
        if self._cleanup_registered:
            return

        atexit.register(self._sync_cleanup_all)

        # Handle signals only if we're the main thread
        try:
            if sys.platform != "win32":
                signal.signal(signal.SIGINT, self._signal_handler)
                signal.signal(signal.SIGTERM, self._signal_handler)
        except ValueError:
            # Not the main thread, skip signal handling
            pass

        self._cleanup_registered = True
        logger.debug("Cleanup handlers registered")

    def _signal_handler(self, signum: int, frame: Any) -> None:
        """Handle termination signals."""
        logger.info(f"Received signal {signum}, initiating cleanup...")
        self._sync_cleanup_all()
        sys.exit(0)

    def _sync_cleanup_all(self) -> None:
        """Synchronous cleanup for atexit/signal handlers."""
        logger.info("Performing synchronous cleanup of all containers...")
        for exp_id in list(self.active_containers.keys()):
            try:
                self._sync_stop_experiment(exp_id)
            except Exception as e:
                logger.error(f"Error during cleanup of experiment {exp_id}: {e}")

    def _sync_stop_experiment(self, experiment_id: int) -> None:
        """Synchronously stop and remove containers for an experiment."""
        if experiment_id not in self.active_containers:
            return

        pair = self.active_containers[experiment_id]

        # Stop and remove containers
        for container, name in [(pair.batsim, "batsim"), (pair.pybatsim, "pybatsim")]:
            if container:
                try:
                    container.stop(timeout=5)
                    logger.debug(f"Stopped {name} container for experiment {experiment_id}")
                except Exception as e:
                    logger.warning(f"Error stopping {name}: {e}")
                try:
                    container.remove(force=True)
                    logger.debug(f"Removed {name} container for experiment {experiment_id}")
                except Exception as e:
                    logger.warning(f"Error removing {name}: {e}")

        # Remove network
        if pair.network_name:
            try:
                network = self.client.networks.get(pair.network_name)
                network.remove()
                logger.debug(f"Removed network {pair.network_name}")
            except NotFound:
                pass
            except Exception as e:
                logger.warning(f"Error removing network: {e}")

        del self.active_containers[experiment_id]

    async def ensure_network(self, experiment_id: int) -> str:
        """
        Create a dedicated Docker network for an experiment.

        Args:
            experiment_id: The experiment ID

        Returns:
            The network name
        """
        network_name = f"{self.network_prefix}-exp-{experiment_id}"

        try:
            self.client.networks.get(network_name)
            logger.debug(f"Network {network_name} already exists")
        except NotFound:
            self.client.networks.create(
                network_name,
                driver="bridge",
                labels={"batsim.experiment_id": str(experiment_id)}
            )
            logger.info(f"Created network {network_name}")

        return network_name

    async def spawn_batsim(
        self,
        experiment_id: int,
        platform_path: str,
        workload_path: str,
        output_dir: str,
    ) -> Container:
        """
        Spawn a BatSim simulator container.

        Args:
            experiment_id: The experiment ID
            platform_path: Absolute path to platform XML file
            workload_path: Absolute path to workload JSON file
            output_dir: Directory for simulation output files

        Returns:
            The created container object
        """
        self._setup_cleanup_handlers()
        network_name = await self.ensure_network(experiment_id)
        container_name = f"batsim-exp-{experiment_id}"

        # Check if container already exists
        try:
            existing = self.client.containers.get(container_name)
            logger.warning(f"Container {container_name} already exists, removing...")
            existing.remove(force=True)
        except NotFound:
            pass

        logger.info(f"Spawning BatSim container for experiment {experiment_id}")
        logger.debug(f"Platform: {platform_path}")
        logger.debug(f"Workload: {workload_path}")
        logger.debug(f"Output: {output_dir}")

        # Build command
        batsim_cmd = [
            "batsim",
            "-p", "/workspace/platform.xml",
            "-w", "/workspace/workload.json",
            "-e", "/workspace/output/",
            "--enable-redis", "false",  # Disable Redis for simplicity
        ]

        try:
            container = self.client.containers.run(
                image=settings.BATSIM_IMAGE,
                name=container_name,
                command=batsim_cmd,
                detach=True,
                volumes={
                    platform_path: {"bind": "/workspace/platform.xml", "mode": "ro"},
                    workload_path: {"bind": "/workspace/workload.json", "mode": "ro"},
                    output_dir: {"bind": "/workspace/output", "mode": "rw"},
                },
                environment={
                    "PYTHONUNBUFFERED": "1",
                },
                network=network_name,
                mem_limit=settings.CONTAINER_MEM_LIMIT,
                cpu_period=100000,
                cpu_quota=int(settings.CONTAINER_CPU_LIMIT * 100000),
                labels={
                    "batsim.experiment_id": str(experiment_id),
                    "batsim.type": "simulator",
                },
            )

            # Track the container
            if experiment_id not in self.active_containers:
                self.active_containers[experiment_id] = ContainerPair(network_name=network_name)
            self.active_containers[experiment_id].batsim = container

            logger.info(f"BatSim container {container.id[:12]} started for experiment {experiment_id}")
            return container

        except APIError as e:
            logger.error(f"Failed to spawn BatSim container: {e}")
            raise RuntimeError(f"Failed to start BatSim: {e}") from e

    async def spawn_pybatsim(
        self,
        experiment_id: int,
        strategy_path: str,
        batsim_host: str,
    ) -> Container:
        """
        Spawn a PyBatsim scheduler container.

        Args:
            experiment_id: The experiment ID
            strategy_path: Absolute path to Python strategy file
            batsim_host: Docker network hostname of BatSim container

        Returns:
            The created container object
        """
        network_name = f"{self.network_prefix}-exp-{experiment_id}"
        container_name = f"pybatsim-exp-{experiment_id}"

        # Check if container already exists
        try:
            existing = self.client.containers.get(container_name)
            logger.warning(f"Container {container_name} already exists, removing...")
            existing.remove(force=True)
        except NotFound:
            pass

        logger.info(f"Spawning PyBatsim container for experiment {experiment_id}")

        # PyBatsim connects to BatSim via ZMQ
        pybatsim_cmd = [
            "pybatsim",
            "/workspace/strategy.py",
            "-s", batsim_host,  # BatSim host
        ]

        try:
            container = self.client.containers.run(
                image=settings.PYBATSIM_IMAGE,
                name=container_name,
                command=pybatsim_cmd,
                detach=True,
                volumes={
                    strategy_path: {"bind": "/workspace/strategy.py", "mode": "ro"},
                },
                environment={
                    "PYTHONUNBUFFERED": "1",
                },
                network=network_name,
                mem_limit=settings.CONTAINER_MEM_LIMIT,
                cpu_period=100000,
                cpu_quota=int(settings.CONTAINER_CPU_LIMIT * 100000),
                labels={
                    "batsim.experiment_id": str(experiment_id),
                    "batsim.type": "scheduler",
                },
            )

            # Track the container
            if experiment_id not in self.active_containers:
                self.active_containers[experiment_id] = ContainerPair(network_name=network_name)
            self.active_containers[experiment_id].pybatsim = container

            logger.info(f"PyBatsim container {container.id[:12]} started for experiment {experiment_id}")
            return container

        except APIError as e:
            logger.error(f"Failed to spawn PyBatsim container: {e}")
            raise RuntimeError(f"Failed to start PyBatsim: {e}") from e

    async def stream_logs(
        self,
        container: Container,
        callback: Optional[Callable[[str], None]] = None,
    ) -> AsyncIterator[str]:
        """
        Stream logs from a container.

        Args:
            container: The container to stream logs from
            callback: Optional callback for each log line

        Yields:
            Log lines as strings
        """
        try:
            for log_bytes in container.logs(stream=True, follow=True):
                line = log_bytes.decode("utf-8", errors="replace").strip()
                if line:
                    if callback:
                        callback(line)
                    yield line
                # Small delay to prevent blocking
                await asyncio.sleep(0.01)
        except Exception as e:
            logger.error(f"Error streaming logs: {e}")
            yield f"[ERROR] Log streaming failed: {e}"

    async def get_container_logs(
        self,
        container: Container,
        tail: int = 100,
    ) -> str:
        """
        Get recent logs from a container.

        Args:
            container: The container
            tail: Number of lines to retrieve

        Returns:
            Log content as string
        """
        try:
            logs = container.logs(tail=tail)
            return logs.decode("utf-8", errors="replace")
        except Exception as e:
            logger.error(f"Error getting logs: {e}")
            return f"[ERROR] Failed to get logs: {e}"

    async def get_container_stats(self, experiment_id: int) -> Dict[str, ContainerStats]:
        """
        Get resource statistics for experiment containers.

        Args:
            experiment_id: The experiment ID

        Returns:
            Dict mapping container type to stats
        """
        if experiment_id not in self.active_containers:
            return {}

        result = {}
        pair = self.active_containers[experiment_id]

        for container, name in [(pair.batsim, "batsim"), (pair.pybatsim, "pybatsim")]:
            if container:
                try:
                    stats = container.stats(stream=False)

                    # Calculate CPU percentage
                    cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                                stats["precpu_stats"]["cpu_usage"]["total_usage"]
                    system_delta = stats["cpu_stats"]["system_cpu_usage"] - \
                                   stats["precpu_stats"]["system_cpu_usage"]
                    cpu_percent = 0.0
                    if system_delta > 0:
                        cpu_percent = (cpu_delta / system_delta) * 100.0

                    # Memory stats
                    mem_usage = stats["memory_stats"].get("usage", 0)
                    mem_limit = stats["memory_stats"].get("limit", 1)

                    result[name] = ContainerStats(
                        cpu_percent=round(cpu_percent, 2),
                        memory_usage_mb=round(mem_usage / (1024 * 1024), 2),
                        memory_limit_mb=round(mem_limit / (1024 * 1024), 2),
                        memory_percent=round((mem_usage / mem_limit) * 100, 2) if mem_limit else 0,
                    )
                except Exception as e:
                    logger.warning(f"Failed to get stats for {name}: {e}")
                    result[name] = ContainerStats()

        return result

    async def get_container_status(self, container: Container) -> str:
        """
        Get the current status of a container.

        Args:
            container: The container

        Returns:
            Status string (running, exited, etc.)
        """
        try:
            container.reload()
            return container.status
        except NotFound:
            return "removed"
        except Exception as e:
            logger.error(f"Error getting container status: {e}")
            return "unknown"

    async def wait_for_container(
        self,
        container: Container,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Wait for a container to finish execution.

        Args:
            container: The container to wait for
            timeout: Optional timeout in seconds

        Returns:
            Dict with StatusCode and Error (if any)
        """
        try:
            result = container.wait(timeout=timeout)
            logger.info(f"Container {container.id[:12]} exited with code {result['StatusCode']}")
            return result
        except Exception as e:
            logger.error(f"Error waiting for container: {e}")
            return {"StatusCode": -1, "Error": str(e)}

    async def stop_experiment(self, experiment_id: int) -> None:
        """
        Stop and remove all containers for an experiment.

        Args:
            experiment_id: The experiment ID
        """
        logger.info(f"Stopping experiment {experiment_id}")

        if experiment_id not in self.active_containers:
            logger.warning(f"No active containers found for experiment {experiment_id}")
            return

        pair = self.active_containers[experiment_id]

        # Stop containers in order (PyBatsim first, then BatSim)
        for container, name in [(pair.pybatsim, "pybatsim"), (pair.batsim, "batsim")]:
            if container:
                try:
                    container.stop(timeout=10)
                    logger.info(f"Stopped {name} container for experiment {experiment_id}")
                except NotFound:
                    logger.debug(f"{name} container already removed")
                except Exception as e:
                    logger.warning(f"Error stopping {name} container: {e}")

                try:
                    container.remove(force=True)
                    logger.debug(f"Removed {name} container")
                except NotFound:
                    pass
                except Exception as e:
                    logger.warning(f"Error removing {name} container: {e}")

        # Remove network
        if pair.network_name:
            try:
                network = self.client.networks.get(pair.network_name)
                network.remove()
                logger.info(f"Removed network {pair.network_name}")
            except NotFound:
                pass
            except Exception as e:
                logger.warning(f"Error removing network: {e}")

        del self.active_containers[experiment_id]
        logger.info(f"Cleanup complete for experiment {experiment_id}")

    async def cleanup_all(self) -> None:
        """Clean up all managed containers."""
        logger.info("Cleaning up all active containers...")
        for exp_id in list(self.active_containers.keys()):
            await self.stop_experiment(exp_id)
        logger.info("All containers cleaned up")

    async def cleanup_orphans(self) -> int:
        """
        Clean up orphaned containers from previous runs.

        Returns:
            Number of containers cleaned up
        """
        count = 0
        try:
            # Find all containers with our labels
            containers = self.client.containers.list(
                all=True,
                filters={"label": "batsim.experiment_id"}
            )

            for container in containers:
                try:
                    logger.info(f"Cleaning up orphan container: {container.name}")
                    container.stop(timeout=5)
                except Exception:
                    pass
                try:
                    container.remove(force=True)
                    count += 1
                except Exception as e:
                    logger.warning(f"Failed to remove orphan container: {e}")

            # Clean up orphaned networks
            networks = self.client.networks.list(
                filters={"label": "batsim.experiment_id"}
            )
            for network in networks:
                try:
                    network.remove()
                    logger.info(f"Removed orphan network: {network.name}")
                except Exception as e:
                    logger.warning(f"Failed to remove orphan network: {e}")

            if count > 0:
                logger.info(f"Cleaned up {count} orphan containers")

        except Exception as e:
            logger.error(f"Error during orphan cleanup: {e}")

        return count

    def is_available(self) -> bool:
        """Check if Docker daemon is available."""
        try:
            self.client.ping()
            return True
        except Exception:
            return False


# Global singleton instance
docker_service = DockerService()
