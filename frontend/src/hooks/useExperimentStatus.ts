/**
 * Hook for tracking experiment status in real-time.
 *
 * Combines WebSocket updates with initial API fetch for a complete
 * experiment status tracking solution.
 */

import { useCallback, useEffect, useState } from "react";
import { useWebSocket, ExperimentStatus, ExperimentProgress, ExperimentLog, MessageType } from "./useWebSocket";
import { experimentsAPI, Experiment } from "../services/api";

export interface ExperimentStatusState {
  /** Experiment data from API */
  experiment: Experiment | null;
  /** Current status string */
  status: string;
  /** Progress percentage (0-100) */
  progressPercentage: number;
  /** Completed jobs count */
  completedJobs: number;
  /** Total jobs count */
  totalJobs: number;
  /** Recent BatSim logs */
  batsimLogs: string[];
  /** Recent PyBatsim logs */
  pybatsimLogs: string[];
  /** Whether currently running */
  isRunning: boolean;
  /** Whether loading initial data */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** WebSocket connection status */
  wsConnected: boolean;
}

/**
 * Hook for tracking a single experiment's status in real-time.
 *
 * @example
 * const {
 *   status,
 *   progressPercentage,
 *   completedJobs,
 *   batsimLogs,
 *   isRunning,
 *   refresh
 * } = useExperimentStatus(experimentId);
 */
export function useExperimentStatus(experimentId: number | null) {
  const [state, setState] = useState<ExperimentStatusState>({
    experiment: null,
    status: "unknown",
    progressPercentage: 0,
    completedJobs: 0,
    totalJobs: 0,
    batsimLogs: [],
    pybatsimLogs: [],
    isRunning: false,
    isLoading: true,
    error: null,
    wsConnected: false,
  });

  const ws = useWebSocket();

  // Fetch initial experiment data
  const fetchExperiment = useCallback(async () => {
    if (!experimentId) {
      setState((prev) => ({ ...prev, isLoading: false, error: "No experiment ID" }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await experimentsAPI.getById(experimentId);
      const exp = response.data;

      setState((prev) => ({
        ...prev,
        experiment: exp,
        status: exp.status,
        progressPercentage: exp.progress_percentage,
        completedJobs: exp.completed_jobs,
        totalJobs: exp.total_jobs || 0,
        batsimLogs: exp.batsim_logs ? exp.batsim_logs.split("\n").slice(-100) : [],
        pybatsimLogs: exp.pybatsim_logs ? exp.pybatsim_logs.split("\n").slice(-100) : [],
        isRunning: exp.status === "running",
        isLoading: false,
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Failed to fetch experiment",
      }));
    }
  }, [experimentId]);

  // Subscribe to WebSocket updates when experiment ID changes
  useEffect(() => {
    if (experimentId && ws.isConnected) {
      ws.subscribe(experimentId);

      return () => {
        ws.unsubscribe(experimentId);
      };
    }
  }, [experimentId, ws.isConnected, ws.subscribe, ws.unsubscribe]);

  // Update connection status
  useEffect(() => {
    setState((prev) => ({ ...prev, wsConnected: ws.isConnected }));
  }, [ws.isConnected]);

  // Handle status updates
  useEffect(() => {
    const unsubscribe = ws.onStatus((data: ExperimentStatus, expId: number) => {
      if (expId === experimentId) {
        setState((prev) => ({
          ...prev,
          status: data.status,
          progressPercentage: data.progress_percentage,
          completedJobs: data.completed_jobs,
          totalJobs: data.total_jobs || prev.totalJobs,
          isRunning: data.status === "running",
        }));
      }
    });

    return unsubscribe;
  }, [experimentId, ws.onStatus]);

  // Handle progress updates
  useEffect(() => {
    const unsubscribe = ws.onProgress((data: ExperimentProgress, expId: number) => {
      if (expId === experimentId) {
        setState((prev) => ({
          ...prev,
          progressPercentage: data.progress_percentage,
          completedJobs: data.completed_jobs,
          totalJobs: data.total_jobs || prev.totalJobs,
        }));
      }
    });

    return unsubscribe;
  }, [experimentId, ws.onProgress]);

  // Handle log updates
  useEffect(() => {
    const unsubscribe = ws.onLog((data: ExperimentLog, expId: number) => {
      if (expId === experimentId) {
        setState((prev) => {
          if (data.log_type === "batsim") {
            const newLogs = [...prev.batsimLogs, data.content].slice(-100);
            return { ...prev, batsimLogs: newLogs };
          } else {
            const newLogs = [...prev.pybatsimLogs, data.content].slice(-100);
            return { ...prev, pybatsimLogs: newLogs };
          }
        });
      }
    });

    return unsubscribe;
  }, [experimentId, ws.onLog]);

  // Handle lifecycle events
  useEffect(() => {
    const unsubscribe = ws.onEvent((type: MessageType, data: any, expId?: number) => {
      if (expId !== experimentId) return;

      switch (type) {
        case "experiment_started":
          setState((prev) => ({ ...prev, status: "running", isRunning: true }));
          break;
        case "experiment_completed":
          setState((prev) => ({
            ...prev,
            status: "completed",
            isRunning: false,
            progressPercentage: 100,
          }));
          break;
        case "experiment_failed":
          setState((prev) => ({
            ...prev,
            status: "failed",
            isRunning: false,
            error: data.error,
          }));
          break;
        case "experiment_stopped":
          setState((prev) => ({
            ...prev,
            status: "cancelled",
            isRunning: false,
          }));
          break;
      }
    });

    return unsubscribe;
  }, [experimentId, ws.onEvent]);

  // Initial fetch
  useEffect(() => {
    fetchExperiment();
  }, [fetchExperiment]);

  return {
    ...state,
    /** Refresh experiment data from API */
    refresh: fetchExperiment,
    /** WebSocket instance for advanced usage */
    ws,
  };
}

/**
 * Hook for tracking multiple experiments at once.
 *
 * @example
 * const { experiments, addExperiment, removeExperiment } = useMultiExperimentStatus();
 */
export function useMultiExperimentStatus() {
  const [experiments, setExperiments] = useState<Map<number, Partial<ExperimentStatusState>>>(new Map());
  const ws = useWebSocket();

  // Subscribe to global updates
  useEffect(() => {
    if (ws.isConnected) {
      ws.subscribeGlobal();

      return () => {
        ws.unsubscribeGlobal();
      };
    }
  }, [ws.isConnected, ws.subscribeGlobal, ws.unsubscribeGlobal]);

  // Handle status updates
  useEffect(() => {
    const unsubscribe = ws.onStatus((data: ExperimentStatus, expId: number) => {
      setExperiments((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(expId) || {};
        newMap.set(expId, {
          ...existing,
          status: data.status,
          progressPercentage: data.progress_percentage,
          completedJobs: data.completed_jobs,
          totalJobs: data.total_jobs || existing.totalJobs,
          isRunning: data.status === "running",
        });
        return newMap;
      });
    });

    return unsubscribe;
  }, [ws.onStatus]);

  // Handle progress updates
  useEffect(() => {
    const unsubscribe = ws.onProgress((data: ExperimentProgress, expId: number) => {
      setExperiments((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(expId) || {};
        newMap.set(expId, {
          ...existing,
          progressPercentage: data.progress_percentage,
          completedJobs: data.completed_jobs,
          totalJobs: data.total_jobs || existing.totalJobs,
        });
        return newMap;
      });
    });

    return unsubscribe;
  }, [ws.onProgress]);

  // Add experiment to tracking
  const addExperiment = useCallback(async (experimentId: number) => {
    try {
      const response = await experimentsAPI.getById(experimentId);
      const exp = response.data;

      setExperiments((prev) => {
        const newMap = new Map(prev);
        newMap.set(experimentId, {
          experiment: exp,
          status: exp.status,
          progressPercentage: exp.progress_percentage,
          completedJobs: exp.completed_jobs,
          totalJobs: exp.total_jobs || 0,
          isRunning: exp.status === "running",
        });
        return newMap;
      });
    } catch (error) {
      console.error(`Failed to add experiment ${experimentId}:`, error);
    }
  }, []);

  // Remove experiment from tracking
  const removeExperiment = useCallback((experimentId: number) => {
    setExperiments((prev) => {
      const newMap = new Map(prev);
      newMap.delete(experimentId);
      return newMap;
    });
  }, []);

  return {
    /** Map of experiment ID to status state */
    experiments,
    /** Add experiment to tracking */
    addExperiment,
    /** Remove experiment from tracking */
    removeExperiment,
    /** WebSocket connection status */
    wsConnected: ws.isConnected,
    /** WebSocket instance */
    ws,
  };
}
