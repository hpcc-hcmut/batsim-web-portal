import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Chip,
  Tabs,
  Tab,
  Paper,
  LinearProgress,
  Divider,
  Alert,
} from "@mui/material";
import { Science, PlayArrow, Stop, Refresh } from "@mui/icons-material";
import { Experiment, experimentsAPI } from "../../services/api";

function getStatusColor(status: string) {
  switch (status) {
    case "completed": return "success" as const;
    case "running": return "warning" as const;
    case "failed": return "error" as const;
    case "cancelled": return "default" as const;
    case "queued": return "info" as const;
    case "pending": return "secondary" as const;
    default: return "default" as const;
  }
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface Props {
  open: boolean;
  experiment: Experiment | null;
  onClose: () => void;
  onStart: (id: number) => void;
  onStop: (id: number) => void;
}

export const ExperimentDetailDialog: React.FC<Props> = ({
  open,
  experiment,
  onClose,
  onStart,
  onStop,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [liveLogs, setLiveLogs] = useState<{ batsim: string; pybatsim: string } | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!experiment) return;
    setLoadingLogs(true);
    try {
      const res = await experimentsAPI.getLogs(experiment.id);
      setLiveLogs({
        batsim: res.data.batsim_logs,
        pybatsim: res.data.pybatsim_logs,
      });
    } catch {
      // Use stored logs as fallback
      setLiveLogs({
        batsim: experiment.batsim_logs || "",
        pybatsim: experiment.pybatsim_logs || "",
      });
    } finally {
      setLoadingLogs(false);
    }
  }, [experiment]);

  // Auto-refresh logs for running experiments
  useEffect(() => {
    if (!open || !experiment) return;
    if (tabValue === 2) {
      fetchLogs();
      if (experiment.status === "running") {
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [open, experiment, tabValue, fetchLogs]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTabValue(0);
      setLiveLogs(null);
    }
  }, [open]);

  if (!experiment) return null;

  const frozenConfig = (() => {
    try {
      return experiment.frozen_config ? JSON.parse(experiment.frozen_config) : null;
    } catch {
      return null;
    }
  })();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { height: "80vh" } }}>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Science sx={{ fontSize: 32, color: "#4a9eff" }} />
          <Box>
            <Typography variant="h5" fontWeight={900}>{experiment.name}</Typography>
            <Chip label={experiment.status} color={getStatusColor(experiment.status)} size="small" />
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Overview" />
            <Tab label="Execution" />
            <Tab label="Logs" />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              {experiment.description || "No description provided."}
            </Typography>
            <Divider />
            <Typography variant="h6">Components</Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
              <Chip label={`Scenario: ${experiment.scenario_name}`} color="primary" />
              <Chip label={`Strategy: ${experiment.strategy_name}`} color="info" />
              {experiment.seed != null && <Chip label={`Seed: ${experiment.seed}`} color="secondary" />}
            </Stack>

            {frozenConfig?.config && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  Frozen Configuration (Immutable)
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2">Workload: {frozenConfig.config.workload?.name} (v{frozenConfig.config.workload?.version})</Typography>
                  <Typography variant="body2">Platform: {frozenConfig.config.platform?.name} (v{frozenConfig.config.platform?.version})</Typography>
                  <Typography variant="body2">Strategy: {frozenConfig.config.strategy?.name} (v{frozenConfig.config.strategy?.version})</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Frozen at: {frozenConfig.created_at ? new Date(frozenConfig.created_at).toLocaleString() : "N/A"}
                  </Typography>
                </Stack>
              </Box>
            )}

            {experiment.error_message && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Error</Typography>
                <Typography variant="body2">{experiment.error_message}</Typography>
              </Alert>
            )}

            <Divider />
            <Typography variant="h6">Timing</Typography>
            <Stack spacing={1}>
              <Typography variant="body2">Created: {new Date(experiment.created_at).toLocaleString()}</Typography>
              {experiment.start_time && (
                <Typography variant="body2">Started: {new Date(experiment.start_time).toLocaleString()}</Typography>
              )}
              {experiment.end_time && (
                <Typography variant="body2">Ended: {new Date(experiment.end_time).toLocaleString()}</Typography>
              )}
            </Stack>
          </Stack>
        </TabPanel>

        {/* Execution Tab */}
        <TabPanel value={tabValue} index={1}>
          <Stack spacing={3}>
            <Typography variant="h6">Execution Status</Typography>
            {experiment.status === "running" && (
              <Box>
                <LinearProgress
                  variant="determinate"
                  value={experiment.progress_percentage || 0}
                  sx={{ height: 8, borderRadius: 4, mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Progress: {experiment.progress_percentage || 0}%
                  {experiment.total_jobs ? ` (${experiment.completed_jobs || 0}/${experiment.total_jobs} jobs)` : ""}
                </Typography>
              </Box>
            )}
            {experiment.status === "completed" && experiment.total_jobs && (
              <Alert severity="success">
                Completed — {experiment.total_jobs} jobs processed
              </Alert>
            )}
            {experiment.status === "failed" && (
              <Alert severity="error">
                {experiment.error_message || "Simulation failed"}
              </Alert>
            )}
            <Divider />
            <Typography variant="h6">Actions</Typography>
            <Box sx={{ display: "flex", gap: 2 }}>
              {experiment.status === "pending" && (
                <Button variant="contained" color="success" startIcon={<PlayArrow />}
                  onClick={() => { onStart(experiment.id); onClose(); }}>
                  Start Experiment
                </Button>
              )}
              {(experiment.status === "running" || experiment.status === "queued") && (
                <Button variant="contained" color="error" startIcon={<Stop />}
                  onClick={() => { onStop(experiment.id); onClose(); }}>
                  {experiment.status === "queued" ? "Cancel" : "Stop"} Experiment
                </Button>
              )}
            </Box>
          </Stack>
        </TabPanel>

        {/* Logs Tab */}
        <TabPanel value={tabValue} index={2}>
          <Stack spacing={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Execution Logs</Typography>
              <Button size="small" startIcon={<Refresh />} onClick={fetchLogs} disabled={loadingLogs}>
                Refresh
              </Button>
            </Stack>
            {loadingLogs && <LinearProgress />}

            {(liveLogs?.batsim || experiment.batsim_logs) && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>BatSim Logs</Typography>
                <Paper sx={{ p: 2, bgcolor: "grey.900", maxHeight: 250, overflow: "auto" }}>
                  <Typography variant="body2" component="pre" sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "grey.100", whiteSpace: "pre-wrap" }}>
                    {liveLogs?.batsim || experiment.batsim_logs}
                  </Typography>
                </Paper>
              </Box>
            )}

            {(liveLogs?.pybatsim || experiment.pybatsim_logs) && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>PyBatsim Logs</Typography>
                <Paper sx={{ p: 2, bgcolor: "grey.900", maxHeight: 250, overflow: "auto" }}>
                  <Typography variant="body2" component="pre" sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "grey.100", whiteSpace: "pre-wrap" }}>
                    {liveLogs?.pybatsim || experiment.pybatsim_logs}
                  </Typography>
                </Paper>
              </Box>
            )}

            {!liveLogs?.batsim && !liveLogs?.pybatsim && !experiment.batsim_logs && !experiment.pybatsim_logs && (
              <Typography color="text.secondary">No logs available yet.</Typography>
            )}
          </Stack>
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
