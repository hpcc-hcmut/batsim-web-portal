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
import { ExperimentCompositionRows } from "./experiment-composition-rows";
import { ExperimentStatusChip } from "./experiment-status-chip";
import { ElapsedTicker } from "./elapsed-ticker";
import { formatDateTime } from "../../utils/format-relative-time";

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
            <Stack direction="row" spacing={1.5} alignItems="center">
              <ExperimentStatusChip status={experiment.status} />
              <ElapsedTicker startTime={experiment.start_time} active={experiment.status === "running"} />
            </Stack>
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
            {/* Failure reason first — the one thing a user of a failed run needs */}
            {experiment.error_message && (
              <Alert severity="error">
                <Typography variant="subtitle2">Error</Typography>
                <Typography variant="body2">{experiment.error_message}</Typography>
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              {experiment.description || "No description provided."}
            </Typography>
            <Divider />
            <Box>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
                <Typography variant="h6">Components</Typography>
                <Chip label={`Scenario: ${experiment.scenario_name}`} color="primary" size="small" />
                {experiment.seed != null && <Chip label={`Seed: ${experiment.seed}`} color="secondary" size="small" />}
              </Stack>
              {/* Rows show FROZEN versions once started; popover has live stats */}
              <ExperimentCompositionRows experiment={experiment} />
              {frozenConfig?.created_at && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Frozen at: {formatDateTime(frozenConfig.created_at)} (immutable snapshot)
                </Typography>
              )}
              {frozenConfig?.hashes && (
                <Box component="details" sx={{ mt: 0.5 }}>
                  <Typography component="summary" variant="caption" sx={{ cursor: "pointer", color: "text.secondary" }}>
                    Integrity hashes (MD5)
                  </Typography>
                  <Stack spacing={0.25} sx={{ mt: 0.5, pl: 1 }}>
                    {Object.entries(frozenConfig.hashes as Record<string, string>).map(([k, v]) => (
                      <Typography key={k} variant="caption" sx={{ fontFamily: "monospace" }}>
                        {k}: {v}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>

            <Divider />
            <Typography variant="h6">Timing</Typography>
            <Stack spacing={1}>
              <Typography variant="body2">Created: {formatDateTime(experiment.created_at)}</Typography>
              {experiment.start_time && (
                <Typography variant="body2">Started: {formatDateTime(experiment.start_time)}</Typography>
              )}
              {experiment.end_time && (
                <Typography variant="body2">Ended: {formatDateTime(experiment.end_time)}</Typography>
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
                {/* Indeterminate while progress is still 0 — a frozen 0% bar
                    reads as "stuck"; a sweeping bar reads as "working" */}
                <LinearProgress
                  variant={(experiment.progress_percentage || 0) > 0 ? "determinate" : "indeterminate"}
                  value={experiment.progress_percentage || 0}
                  sx={{
                    height: 8, borderRadius: 4, mb: 1,
                    "& .MuiLinearProgress-bar": { transition: "transform 500ms linear" },
                  }}
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
              {/* Keep the dialog OPEN after start/stop — the parent's auto-refresh
                  updates selectedExperiment so the user watches status/progress here */}
              {experiment.status === "pending" && (
                <Button variant="contained" color="success" startIcon={<PlayArrow />}
                  onClick={() => onStart(experiment.id)}>
                  Start Experiment
                </Button>
              )}
              {(experiment.status === "running" || experiment.status === "queued") && (
                <Button variant="contained" color="error" startIcon={<Stop />}
                  onClick={() => onStop(experiment.id)}>
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
