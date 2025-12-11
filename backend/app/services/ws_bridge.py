"""
WebSocket Bridge - Connects simulation events to WebSocket broadcasts.

This module bridges the simulation service callbacks to the WebSocket manager,
enabling real-time updates to connected clients.
"""

import asyncio
import logging
from typing import Optional

from app.core.ws_manager import ws_manager, MessageType

logger = logging.getLogger(__name__)


class WebSocketBridge:
    """
    Bridges simulation service events to WebSocket broadcasts.

    Usage:
        # During simulation startup
        ws_bridge.register_experiment(experiment_id)

        # During simulation (called by simulation_service)
        await ws_bridge.broadcast_progress(experiment_id, 50, "Processing jobs")
        await ws_bridge.broadcast_log(experiment_id, "batsim", "Job 1 completed")

        # On simulation end
        await ws_bridge.broadcast_completed(experiment_id)
    """

    def __init__(self):
        self._event_loop: Optional[asyncio.AbstractEventLoop] = None

    def _get_event_loop(self) -> asyncio.AbstractEventLoop:
        """Get or create an event loop for async operations."""
        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            if self._event_loop is None or self._event_loop.is_closed():
                self._event_loop = asyncio.new_event_loop()
            return self._event_loop

    async def broadcast_progress(
        self,
        experiment_id: int,
        progress_percentage: int,
        completed_jobs: int,
        total_jobs: Optional[int] = None,
    ) -> None:
        """Broadcast experiment progress update via WebSocket."""
        try:
            await ws_manager.broadcast_experiment_progress(
                experiment_id=experiment_id,
                progress_percentage=progress_percentage,
                completed_jobs=completed_jobs,
                total_jobs=total_jobs,
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast progress for exp {experiment_id}: {e}")

    async def broadcast_status(
        self,
        experiment_id: int,
        status: str,
        progress_percentage: int = 0,
        completed_jobs: int = 0,
        total_jobs: Optional[int] = None,
        elapsed_seconds: Optional[float] = None,
    ) -> None:
        """Broadcast experiment status update via WebSocket."""
        try:
            await ws_manager.broadcast_experiment_status(
                experiment_id=experiment_id,
                status=status,
                progress_percentage=progress_percentage,
                completed_jobs=completed_jobs,
                total_jobs=total_jobs,
                elapsed_seconds=elapsed_seconds,
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast status for exp {experiment_id}: {e}")

    async def broadcast_log(
        self,
        experiment_id: int,
        log_type: str,
        content: str,
    ) -> None:
        """Broadcast log message via WebSocket."""
        try:
            await ws_manager.broadcast_experiment_log(
                experiment_id=experiment_id,
                log_type=log_type,
                log_content=content,
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast log for exp {experiment_id}: {e}")

    async def broadcast_started(self, experiment_id: int) -> None:
        """Broadcast experiment started event."""
        try:
            await ws_manager.broadcast_experiment_event(
                experiment_id=experiment_id,
                event_type=MessageType.EXPERIMENT_STARTED,
                data={"message": "Experiment started"},
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast started for exp {experiment_id}: {e}")

    async def broadcast_completed(
        self,
        experiment_id: int,
        total_jobs: Optional[int] = None,
        elapsed_seconds: Optional[float] = None,
    ) -> None:
        """Broadcast experiment completed event."""
        try:
            await ws_manager.broadcast_experiment_event(
                experiment_id=experiment_id,
                event_type=MessageType.EXPERIMENT_COMPLETED,
                data={
                    "message": "Experiment completed successfully",
                    "total_jobs": total_jobs,
                    "elapsed_seconds": elapsed_seconds,
                },
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast completed for exp {experiment_id}: {e}")

    async def broadcast_failed(
        self,
        experiment_id: int,
        error_message: str,
    ) -> None:
        """Broadcast experiment failed event."""
        try:
            await ws_manager.broadcast_experiment_event(
                experiment_id=experiment_id,
                event_type=MessageType.EXPERIMENT_FAILED,
                data={
                    "message": "Experiment failed",
                    "error": error_message,
                },
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast failed for exp {experiment_id}: {e}")

    async def broadcast_stopped(self, experiment_id: int) -> None:
        """Broadcast experiment stopped event."""
        try:
            await ws_manager.broadcast_experiment_event(
                experiment_id=experiment_id,
                event_type=MessageType.EXPERIMENT_STOPPED,
                data={"message": "Experiment stopped by user"},
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast stopped for exp {experiment_id}: {e}")

    def sync_broadcast_progress(
        self,
        experiment_id: int,
        progress_percentage: int,
        completed_jobs: int,
        total_jobs: Optional[int] = None,
    ) -> None:
        """
        Synchronous wrapper for broadcasting progress.
        Use when called from non-async context.
        """
        try:
            loop = self._get_event_loop()
            if loop.is_running():
                # Schedule as a task
                asyncio.create_task(
                    self.broadcast_progress(
                        experiment_id, progress_percentage, completed_jobs, total_jobs
                    )
                )
            else:
                loop.run_until_complete(
                    self.broadcast_progress(
                        experiment_id, progress_percentage, completed_jobs, total_jobs
                    )
                )
        except Exception as e:
            logger.warning(f"Sync broadcast progress failed: {e}")

    def sync_broadcast_log(
        self,
        experiment_id: int,
        log_type: str,
        content: str,
    ) -> None:
        """
        Synchronous wrapper for broadcasting logs.
        Use when called from non-async context.
        """
        try:
            loop = self._get_event_loop()
            if loop.is_running():
                asyncio.create_task(
                    self.broadcast_log(experiment_id, log_type, content)
                )
            else:
                loop.run_until_complete(
                    self.broadcast_log(experiment_id, log_type, content)
                )
        except Exception as e:
            logger.warning(f"Sync broadcast log failed: {e}")


# Global bridge instance
ws_bridge = WebSocketBridge()
