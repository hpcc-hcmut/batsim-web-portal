"""
WebSocket API endpoints for real-time experiment updates.

Provides WebSocket connections for:
- Experiment status updates
- Log streaming
- Progress monitoring
"""

import asyncio
import logging
import uuid
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.ws_manager import ws_manager, MessageType, WebSocketMessage
from app.models import Experiment
from app.core.security import verify_token

logger = logging.getLogger(__name__)

router = APIRouter()


async def get_user_from_token(token: Optional[str]) -> Optional[str]:
    """
    Extract username from JWT token for WebSocket authentication.
    Returns None if token is invalid or missing.
    """
    if not token:
        return None

    try:
        username = verify_token(token)
        return username
    except Exception as e:
        logger.warning(f"Failed to decode WebSocket token: {e}")

    return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    Main WebSocket endpoint for real-time updates.

    Connection URL: ws://localhost:8000/api/ws?token=<jwt_token>

    Messages from client:
    - {"type": "ping", "data": {}}
    - {"type": "subscribe", "data": {"experiment_id": 123}}
    - {"type": "subscribe", "data": {"scope": "global"}}
    - {"type": "unsubscribe", "data": {"experiment_id": 123}}
    - {"type": "unsubscribe", "data": {"scope": "global"}}

    Messages from server:
    - {"type": "connected", "data": {...}, "timestamp": "..."}
    - {"type": "experiment_status", "data": {...}, "experiment_id": 123}
    - {"type": "experiment_progress", "data": {...}, "experiment_id": 123}
    - {"type": "experiment_log", "data": {...}, "experiment_id": 123}
    - {"type": "experiment_started", "data": {...}, "experiment_id": 123}
    - {"type": "experiment_completed", "data": {...}, "experiment_id": 123}
    - {"type": "experiment_failed", "data": {...}, "experiment_id": 123}
    """
    connection_id = str(uuid.uuid4())
    user_id = await get_user_from_token(token)

    try:
        await ws_manager.connect(websocket, connection_id, user_id)

        while True:
            try:
                # Wait for incoming messages with a timeout for keepalive
                raw_message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=60.0  # 60 second timeout
                )
                await ws_manager.handle_incoming_message(websocket, raw_message)

            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                try:
                    await websocket.send_text(
                        WebSocketMessage(
                            type=MessageType.PING,
                            data={},
                        ).to_json()
                    )
                except Exception:
                    break  # Connection dead

    except WebSocketDisconnect:
        logger.info(f"WebSocket {connection_id} disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error for {connection_id}: {e}")
    finally:
        await ws_manager.disconnect(websocket)


@router.websocket("/ws/experiment/{experiment_id}")
async def experiment_websocket(
    websocket: WebSocket,
    experiment_id: int,
    token: Optional[str] = Query(None),
):
    """
    Dedicated WebSocket endpoint for a specific experiment.

    Automatically subscribes to the experiment on connection.
    Connection URL: ws://localhost:8000/api/ws/experiment/123?token=<jwt_token>
    """
    connection_id = str(uuid.uuid4())
    user_id = await get_user_from_token(token)

    try:
        await ws_manager.connect(websocket, connection_id, user_id)

        # Auto-subscribe to the specific experiment
        await ws_manager.subscribe_to_experiment(websocket, experiment_id)

        while True:
            try:
                raw_message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=60.0
                )
                await ws_manager.handle_incoming_message(websocket, raw_message)

            except asyncio.TimeoutError:
                try:
                    await websocket.send_text(
                        WebSocketMessage(
                            type=MessageType.PING,
                            data={},
                        ).to_json()
                    )
                except Exception:
                    break

    except WebSocketDisconnect:
        logger.info(f"Experiment WebSocket {connection_id} disconnected")
    except Exception as e:
        logger.error(f"Experiment WebSocket error: {e}")
    finally:
        await ws_manager.disconnect(websocket)


@router.websocket("/ws/logs/{experiment_id}")
async def logs_websocket(
    websocket: WebSocket,
    experiment_id: int,
    token: Optional[str] = Query(None),
):
    """
    Dedicated WebSocket endpoint for streaming experiment logs.

    Sends log updates as they become available.
    Connection URL: ws://localhost:8000/api/ws/logs/123?token=<jwt_token>
    """
    connection_id = str(uuid.uuid4())
    user_id = await get_user_from_token(token)

    try:
        await ws_manager.connect(websocket, connection_id, user_id)
        await ws_manager.subscribe_to_experiment(websocket, experiment_id)

        # Send initial log state if experiment exists
        # Note: This would need a database session to fetch initial logs
        # For now, client will receive subsequent log updates via subscription

        while True:
            try:
                raw_message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=60.0
                )
                await ws_manager.handle_incoming_message(websocket, raw_message)

            except asyncio.TimeoutError:
                try:
                    await websocket.send_text(
                        WebSocketMessage(
                            type=MessageType.PING,
                            data={},
                        ).to_json()
                    )
                except Exception:
                    break

    except WebSocketDisconnect:
        logger.info(f"Logs WebSocket {connection_id} disconnected")
    except Exception as e:
        logger.error(f"Logs WebSocket error: {e}")
    finally:
        await ws_manager.disconnect(websocket)


@router.get("/ws/stats")
async def get_websocket_stats():
    """
    Get WebSocket connection statistics (admin endpoint).
    """
    return ws_manager.get_stats()
