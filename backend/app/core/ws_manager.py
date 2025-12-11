"""
WebSocket Connection Manager for BatSim Web Portal.

Handles WebSocket connections, message broadcasting, and room-based subscriptions
for real-time experiment status updates and log streaming.
"""

import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """WebSocket message types."""
    # Connection events
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    PING = "ping"
    PONG = "pong"

    # Experiment events
    EXPERIMENT_STATUS = "experiment_status"
    EXPERIMENT_PROGRESS = "experiment_progress"
    EXPERIMENT_LOG = "experiment_log"
    EXPERIMENT_STARTED = "experiment_started"
    EXPERIMENT_COMPLETED = "experiment_completed"
    EXPERIMENT_FAILED = "experiment_failed"
    EXPERIMENT_STOPPED = "experiment_stopped"

    # Container events
    CONTAINER_STATS = "container_stats"

    # Subscription management
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    SUBSCRIBED = "subscribed"
    UNSUBSCRIBED = "unsubscribed"


@dataclass
class WebSocketMessage:
    """Standardized WebSocket message format."""
    type: MessageType
    data: Dict[str, Any]
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    experiment_id: Optional[int] = None

    def to_json(self) -> str:
        return json.dumps({
            "type": self.type.value,
            "data": self.data,
            "timestamp": self.timestamp,
            "experiment_id": self.experiment_id,
        })


class WebSocketManager:
    """
    Manages WebSocket connections and message broadcasting.

    Features:
    - Connection tracking by user/session
    - Room-based subscriptions (subscribe to specific experiments)
    - Broadcast messages to all subscribers of an experiment
    - Heartbeat/ping-pong for connection health
    """

    def __init__(self):
        # Active connections: websocket -> connection_id
        self._connections: Dict[WebSocket, str] = {}

        # Experiment subscriptions: experiment_id -> set of websockets
        self._experiment_subscribers: Dict[int, Set[WebSocket]] = {}

        # Global subscribers (receive all experiment updates)
        self._global_subscribers: Set[WebSocket] = set()

        # Connection metadata: websocket -> {user_id, subscriptions, etc}
        self._connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}

        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

        logger.info("WebSocket Manager initialized")

    async def connect(
        self,
        websocket: WebSocket,
        connection_id: str,
        user_id: Optional[int] = None,
    ) -> None:
        """
        Accept a new WebSocket connection.

        Args:
            websocket: The WebSocket connection
            connection_id: Unique identifier for this connection
            user_id: Optional user ID if authenticated
        """
        await websocket.accept()

        async with self._lock:
            self._connections[websocket] = connection_id
            self._connection_metadata[websocket] = {
                "user_id": user_id,
                "connected_at": datetime.utcnow().isoformat(),
                "subscriptions": set(),
            }

        logger.info(f"WebSocket connected: {connection_id} (user={user_id})")

        # Send connection confirmation
        await self._send_message(
            websocket,
            WebSocketMessage(
                type=MessageType.CONNECTED,
                data={
                    "connection_id": connection_id,
                    "user_id": user_id,
                    "message": "Connected to BatSim WebSocket server",
                },
            ),
        )

    async def disconnect(self, websocket: WebSocket) -> None:
        """
        Handle WebSocket disconnection and cleanup subscriptions.
        """
        async with self._lock:
            connection_id = self._connections.pop(websocket, None)
            metadata = self._connection_metadata.pop(websocket, {})

            # Remove from global subscribers
            self._global_subscribers.discard(websocket)

            # Remove from all experiment subscriptions
            for exp_id in list(self._experiment_subscribers.keys()):
                self._experiment_subscribers[exp_id].discard(websocket)
                # Clean up empty subscription sets
                if not self._experiment_subscribers[exp_id]:
                    del self._experiment_subscribers[exp_id]

        logger.info(f"WebSocket disconnected: {connection_id}")

    async def subscribe_to_experiment(
        self,
        websocket: WebSocket,
        experiment_id: int,
    ) -> None:
        """
        Subscribe a WebSocket connection to receive updates for a specific experiment.
        """
        async with self._lock:
            if experiment_id not in self._experiment_subscribers:
                self._experiment_subscribers[experiment_id] = set()

            self._experiment_subscribers[experiment_id].add(websocket)

            # Track subscription in metadata
            if websocket in self._connection_metadata:
                self._connection_metadata[websocket]["subscriptions"].add(experiment_id)

        logger.debug(f"WebSocket subscribed to experiment {experiment_id}")

        await self._send_message(
            websocket,
            WebSocketMessage(
                type=MessageType.SUBSCRIBED,
                data={"experiment_id": experiment_id},
                experiment_id=experiment_id,
            ),
        )

    async def unsubscribe_from_experiment(
        self,
        websocket: WebSocket,
        experiment_id: int,
    ) -> None:
        """
        Unsubscribe a WebSocket connection from a specific experiment.
        """
        async with self._lock:
            if experiment_id in self._experiment_subscribers:
                self._experiment_subscribers[experiment_id].discard(websocket)

                # Clean up empty sets
                if not self._experiment_subscribers[experiment_id]:
                    del self._experiment_subscribers[experiment_id]

            # Update metadata
            if websocket in self._connection_metadata:
                self._connection_metadata[websocket]["subscriptions"].discard(experiment_id)

        logger.debug(f"WebSocket unsubscribed from experiment {experiment_id}")

        await self._send_message(
            websocket,
            WebSocketMessage(
                type=MessageType.UNSUBSCRIBED,
                data={"experiment_id": experiment_id},
                experiment_id=experiment_id,
            ),
        )

    async def subscribe_global(self, websocket: WebSocket) -> None:
        """Subscribe to receive all experiment updates."""
        async with self._lock:
            self._global_subscribers.add(websocket)

        await self._send_message(
            websocket,
            WebSocketMessage(
                type=MessageType.SUBSCRIBED,
                data={"scope": "global", "message": "Subscribed to all experiment updates"},
            ),
        )

    async def unsubscribe_global(self, websocket: WebSocket) -> None:
        """Unsubscribe from global updates."""
        async with self._lock:
            self._global_subscribers.discard(websocket)

        await self._send_message(
            websocket,
            WebSocketMessage(
                type=MessageType.UNSUBSCRIBED,
                data={"scope": "global"},
            ),
        )

    async def broadcast_to_experiment(
        self,
        experiment_id: int,
        message: WebSocketMessage,
    ) -> int:
        """
        Broadcast a message to all subscribers of a specific experiment.

        Returns:
            Number of connections the message was sent to
        """
        message.experiment_id = experiment_id
        recipients: Set[WebSocket] = set()

        async with self._lock:
            # Add experiment-specific subscribers
            if experiment_id in self._experiment_subscribers:
                recipients.update(self._experiment_subscribers[experiment_id])

            # Add global subscribers
            recipients.update(self._global_subscribers)

        sent_count = 0
        for websocket in recipients:
            try:
                await self._send_message(websocket, message)
                sent_count += 1
            except Exception as e:
                logger.warning(f"Failed to send message to websocket: {e}")
                # Don't remove here - let the receive loop handle disconnection

        return sent_count

    async def broadcast_experiment_status(
        self,
        experiment_id: int,
        status: str,
        progress_percentage: int,
        completed_jobs: int,
        total_jobs: Optional[int] = None,
        elapsed_seconds: Optional[float] = None,
    ) -> int:
        """Broadcast experiment status update."""
        return await self.broadcast_to_experiment(
            experiment_id,
            WebSocketMessage(
                type=MessageType.EXPERIMENT_STATUS,
                data={
                    "status": status,
                    "progress_percentage": progress_percentage,
                    "completed_jobs": completed_jobs,
                    "total_jobs": total_jobs,
                    "elapsed_seconds": elapsed_seconds,
                },
                experiment_id=experiment_id,
            ),
        )

    async def broadcast_experiment_progress(
        self,
        experiment_id: int,
        progress_percentage: int,
        completed_jobs: int,
        total_jobs: Optional[int] = None,
    ) -> int:
        """Broadcast experiment progress update."""
        return await self.broadcast_to_experiment(
            experiment_id,
            WebSocketMessage(
                type=MessageType.EXPERIMENT_PROGRESS,
                data={
                    "progress_percentage": progress_percentage,
                    "completed_jobs": completed_jobs,
                    "total_jobs": total_jobs,
                },
                experiment_id=experiment_id,
            ),
        )

    async def broadcast_experiment_log(
        self,
        experiment_id: int,
        log_type: str,  # "batsim" or "pybatsim"
        log_content: str,
    ) -> int:
        """Broadcast new log content for an experiment."""
        return await self.broadcast_to_experiment(
            experiment_id,
            WebSocketMessage(
                type=MessageType.EXPERIMENT_LOG,
                data={
                    "log_type": log_type,
                    "content": log_content,
                },
                experiment_id=experiment_id,
            ),
        )

    async def broadcast_experiment_event(
        self,
        experiment_id: int,
        event_type: MessageType,
        data: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Broadcast a specific experiment event."""
        return await self.broadcast_to_experiment(
            experiment_id,
            WebSocketMessage(
                type=event_type,
                data=data or {},
                experiment_id=experiment_id,
            ),
        )

    async def _send_message(
        self,
        websocket: WebSocket,
        message: WebSocketMessage,
    ) -> None:
        """Send a message to a specific WebSocket connection."""
        try:
            await websocket.send_text(message.to_json())
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            raise

    async def handle_incoming_message(
        self,
        websocket: WebSocket,
        raw_message: str,
    ) -> None:
        """
        Process incoming WebSocket messages from clients.

        Handles subscription management and ping/pong.
        """
        try:
            data = json.loads(raw_message)
            msg_type = data.get("type")
            payload = data.get("data", {})

            if msg_type == MessageType.PING.value:
                await self._send_message(
                    websocket,
                    WebSocketMessage(type=MessageType.PONG, data={}),
                )

            elif msg_type == MessageType.SUBSCRIBE.value:
                experiment_id = payload.get("experiment_id")
                scope = payload.get("scope")

                if experiment_id:
                    await self.subscribe_to_experiment(websocket, int(experiment_id))
                elif scope == "global":
                    await self.subscribe_global(websocket)

            elif msg_type == MessageType.UNSUBSCRIBE.value:
                experiment_id = payload.get("experiment_id")
                scope = payload.get("scope")

                if experiment_id:
                    await self.unsubscribe_from_experiment(websocket, int(experiment_id))
                elif scope == "global":
                    await self.unsubscribe_global(websocket)

            else:
                logger.warning(f"Unknown message type: {msg_type}")

        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON received: {raw_message[:100]}")
            await self._send_message(
                websocket,
                WebSocketMessage(
                    type=MessageType.ERROR,
                    data={"message": "Invalid JSON format"},
                ),
            )
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")

    def get_connection_count(self) -> int:
        """Return the number of active WebSocket connections."""
        return len(self._connections)

    def get_experiment_subscriber_count(self, experiment_id: int) -> int:
        """Return the number of subscribers for a specific experiment."""
        return len(self._experiment_subscribers.get(experiment_id, set()))

    def get_stats(self) -> Dict[str, Any]:
        """Return WebSocket manager statistics."""
        return {
            "total_connections": len(self._connections),
            "global_subscribers": len(self._global_subscribers),
            "experiment_subscriptions": {
                exp_id: len(subs)
                for exp_id, subs in self._experiment_subscribers.items()
            },
        }


# Global WebSocket manager instance
ws_manager = WebSocketManager()
