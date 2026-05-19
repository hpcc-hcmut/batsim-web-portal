import React, { useState, useEffect } from "react";
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
  LinearProgress,
  Divider,
  Alert,
} from "@mui/material";
import { Science, PlayArrow, Stop, Dashboard } from "@mui/icons-material";
import { Experiment, systemAPI } from "../../services/api";
import { LogStreamViewer } from "./log-stream-viewer";
import { ProgressHeaderStrip } from "./progress-header-strip";

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
  const [grafanaUrl, setGrafanaUrl] = useState<string | null>(null);

  // Fetch Grafana URL on mount
  useEffect(() => {
    systemAPI.getConfig().then((res) => {
      setGrafanaUrl(res.data.grafana_url);
    }).catch(() => {});
  }, []);

  // Reset tab on close
  useEffect(() => {
    if (!open) setTabValue(0);
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
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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
              {grafanaUrl && (
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<Dashboard />}
                  href={`${grafanaUrl}/d/batsim-experiment-overview?var-experiment_id=${experiment.id}&from=now-1h&to=now`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Monitoring Dashboard
                </Button>
              )}
            </Box>
          </Stack>
        </TabPanel>

        {/* Logs Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <ProgressHeaderStrip
              experimentId={experiment.id}
              live={experiment.status === "running"}
            />
            <LogStreamViewer
              experimentId={experiment.id}
              live={experiment.status === "running"}
            />
          </Box>
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
