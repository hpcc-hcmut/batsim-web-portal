/**
 * WebSocket Hook for BatSim Web Portal
 *
 * Provides real-time experiment updates via WebSocket connection.
 * Handles connection management, reconnection, and message parsing.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// WebSocket message types
export type MessageType =
  | "connected"
  | "disconnected"
  | "error"
  | "ping"
  | "pong"
  | "experiment_status"
  | "experiment_progress"
  | "experiment_log"
  | "experiment_started"
  | "experiment_completed"
  | "experiment_failed"
  | "experiment_stopped"
  | "container_stats"
  | "subscribe"
  | "unsubscribe"
  | "subscribed"
  | "unsubscribed";

export interface WebSocketMessage {
  type: MessageType;
  data: Record<string, any>;
  timestamp: string;
  experiment_id?: number;
}

export interface ExperimentStatus {
  status: string;
  progress_percentage: number;
  completed_jobs: number;
  total_jobs?: number;
  elapsed_seconds?: number;
}

export interface ExperimentProgress {
  progress_percentage: number;
  completed_jobs: number;
  total_jobs?: number;
}

export interface ExperimentLog {
  log_type: "batsim" | "pybatsim";
  content: string;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface UseWebSocketOptions {
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
  /** Max reconnection attempts */
  maxReconnectAttempts?: number;
  /** JWT token for authentication */
  token?: string;
}

const DEFAULT_OPTIONS: UseWebSocketOptions = {
  autoReconnect: true,
  reconnectDelay: 3000,
  maxReconnectAttempts: 10,
};

/**
 * WebSocket hook for real-time experiment updates.
 *
 * @example
 * const {
 *   status,
 *   subscribe,
 *   unsubscribe,
 *   onStatus,
 *   onProgress,
 *   onLog,
 * } = useWebSocket();
 *
 * // Subscribe to an experiment
 * subscribe(experimentId);
 *
 * // Listen to status updates
 * onStatus((data, expId) => {
 *   console.log(`Experiment ${expId} status:`, data);
 * });
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  // Callbacks for different message types
  const statusCallbacksRef = useRef<Set<(data: ExperimentStatus, experimentId: number) => void>>(new Set());
  const progressCallbacksRef = useRef<Set<(data: ExperimentProgress, experimentId: number) => void>>(new Set());
  const logCallbacksRef = useRef<Set<(data: ExperimentLog, experimentId: number) => void>>(new Set());
  const eventCallbacksRef = useRef<Set<(type: MessageType, data: any, experimentId?: number) => void>>(new Set());

  // Build WebSocket URL
  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = "8000"; // Backend port
    const tokenParam = opts.token ? `?token=${opts.token}` : "";
    return `${protocol}//${host}:${port}/api/ws${tokenParam}`;
  }, [opts.token]);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus("connecting");

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Connected");
        setConnectionStatus("connected");
        reconnectAttemptRef.current = 0;
      };

      ws.onclose = (event) => {
        console.log("[WebSocket] Disconnected:", event.code, event.reason);
        setConnectionStatus("disconnected");
        wsRef.current = null;

        // Auto-reconnect
        if (opts.autoReconnect && reconnectAttemptRef.current < (opts.maxReconnectAttempts || 10)) {
          reconnectAttemptRef.current++;
          const delay = opts.reconnectDelay || 3000;
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        setConnectionStatus("error");
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Handle ping/pong
          if (message.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", data: {} }));
            return;
          }

          // Notify event callbacks
          eventCallbacksRef.current.forEach((cb) => {
            cb(message.type, message.data, message.experiment_id);
          });

          // Handle specific message types
          switch (message.type) {
            case "experiment_status":
              statusCallbacksRef.current.forEach((cb) => {
                if (message.experiment_id !== undefined) {
                  cb(message.data as ExperimentStatus, message.experiment_id);
                }
              });
              break;

            case "experiment_progress":
              progressCallbacksRef.current.forEach((cb) => {
                if (message.experiment_id !== undefined) {
                  cb(message.data as ExperimentProgress, message.experiment_id);
                }
              });
              break;

            case "experiment_log":
              logCallbacksRef.current.forEach((cb) => {
                if (message.experiment_id !== undefined) {
                  cb(message.data as ExperimentLog, message.experiment_id);
                }
              });
              break;

            default:
              // Handle other event types via eventCallbacks
              break;
          }
        } catch (e) {
          console.error("[WebSocket] Failed to parse message:", e);
        }
      };
    } catch (error) {
      console.error("[WebSocket] Failed to connect:", error);
      setConnectionStatus("error");
    }
  }, [getWsUrl, opts.autoReconnect, opts.maxReconnectAttempts, opts.reconnectDelay]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }

    setConnectionStatus("disconnected");
  }, []);

  // Send a message to the server
  const send = useCallback((type: string, data: Record<string, any> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
      return true;
    }
    console.warn("[WebSocket] Cannot send - not connected");
    return false;
  }, []);

  // Subscribe to experiment updates
  const subscribe = useCallback((experimentId: number) => {
    return send("subscribe", { experiment_id: experimentId });
  }, [send]);

  // Unsubscribe from experiment updates
  const unsubscribe = useCallback((experimentId: number) => {
    return send("unsubscribe", { experiment_id: experimentId });
  }, [send]);

  // Subscribe to global updates (all experiments)
  const subscribeGlobal = useCallback(() => {
    return send("subscribe", { scope: "global" });
  }, [send]);

  // Unsubscribe from global updates
  const unsubscribeGlobal = useCallback(() => {
    return send("unsubscribe", { scope: "global" });
  }, [send]);

  // Register status callback
  const onStatus = useCallback((callback: (data: ExperimentStatus, experimentId: number) => void) => {
    statusCallbacksRef.current.add(callback);
    return () => {
      statusCallbacksRef.current.delete(callback);
    };
  }, []);

  // Register progress callback
  const onProgress = useCallback((callback: (data: ExperimentProgress, experimentId: number) => void) => {
    progressCallbacksRef.current.add(callback);
    return () => {
      progressCallbacksRef.current.delete(callback);
    };
  }, []);

  // Register log callback
  const onLog = useCallback((callback: (data: ExperimentLog, experimentId: number) => void) => {
    logCallbacksRef.current.add(callback);
    return () => {
      logCallbacksRef.current.delete(callback);
    };
  }, []);

  // Register generic event callback
  const onEvent = useCallback((callback: (type: MessageType, data: any, experimentId?: number) => void) => {
    eventCallbacksRef.current.add(callback);
    return () => {
      eventCallbacksRef.current.delete(callback);
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    /** Current connection status */
    status: connectionStatus,
    /** Whether connected */
    isConnected: connectionStatus === "connected",
    /** Last received message */
    lastMessage,
    /** Connect to server */
    connect,
    /** Disconnect from server */
    disconnect,
    /** Subscribe to experiment updates */
    subscribe,
    /** Unsubscribe from experiment updates */
    unsubscribe,
    /** Subscribe to all experiment updates */
    subscribeGlobal,
    /** Unsubscribe from global updates */
    unsubscribeGlobal,
    /** Register status update callback */
    onStatus,
    /** Register progress update callback */
    onProgress,
    /** Register log update callback */
    onLog,
    /** Register generic event callback */
    onEvent,
    /** Send raw message */
    send,
  };
}
