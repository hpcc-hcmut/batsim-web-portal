/**
 * MonitoringPage - Real-time experiment monitoring dashboard.
 *
 * Uses WebSocket hooks for live updates of experiment progress and logs.
 */

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  Stack,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Paper,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Monitor,
  Refresh,
  Add,
  Wifi,
  WifiOff,
  Science,
  Dashboard,
} from "@mui/icons-material";
import { experimentsAPI, Experiment } from "../services/api";
import { useExperimentStatus, useMultiExperimentStatus } from "../hooks";
import {
  RealtimeProgressChart,
  LiveLogViewer,
  ExperimentComparison,
} from "../components/monitoring";
import GrafanaEmbed from "../components/GrafanaEmbed";

const MonitoringPage: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | null>(null);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);
  const [viewTab, setViewTab] = useState(0); // 0 = Experiments, 1 = Grafana

  // Single experiment status via WebSocket
  const experimentStatus = useExperimentStatus(selectedExperimentId);

  // Multi-experiment tracking for comparison
  const multiStatus = useMultiExperimentStatus();

  // Fetch all experiments on mount
  useEffect(() => {
    const fetchExperiments = async () => {
      try {
        const res = await experimentsAPI.getAll();
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setExperiments(data);

        // Auto-select first running experiment if any
        const running = data.find((e: Experiment) => e.status === "running");
        if (running) {
          setSelectedExperimentId(running.id);
        }
      } catch (error) {
        console.error("Failed to fetch experiments:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchExperiments();
  }, []);

  // Refresh experiments list
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await experimentsAPI.getAll();
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any).items || [];
      setExperiments(data);
    } catch (error) {
      console.error("Failed to refresh:", error);
    } finally {
      setLoading(false);
    }
  };

  // Add experiment to comparison
  const handleAddToComparison = (id: number) => {
    if (comparisonIds.length < 3 && !comparisonIds.includes(id)) {
      setComparisonIds([...comparisonIds, id]);
      multiStatus.addExperiment(id);
    }
  };

  // Remove experiment from comparison
  const handleRemoveFromComparison = (id: number) => {
    setComparisonIds(comparisonIds.filter((cid) => cid !== id));
    multiStatus.removeExperiment(id);
  };

  // Get running experiments
  const runningExperiments = experiments.filter((e) => e.status === "running");

  // Build comparison data
  const comparisonData = comparisonIds.map((id) => {
    const exp = experiments.find((e) => e.id === id);
    const status = multiStatus.experiments.get(id);
    return {
      id,
      name: exp?.name || `Experiment ${id}`,
      status: status?.status || exp?.status || "unknown",
      progressPercentage: status?.progressPercentage || exp?.progress_percentage || 0,
      completedJobs: status?.completedJobs || exp?.completed_jobs || 0,
      totalJobs: status?.totalJobs || exp?.total_jobs || 0,
      scenarioName: exp?.scenario_name,
      strategyName: exp?.strategy_name,
    };
  });

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Monitor sx={{ fontSize: 36, color: "#4a9eff" }} />
          <Box>
            <Typography variant="h4" fontWeight={900}>
              Real-time Monitoring
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Live experiment progress, logs, and comparison
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={2}>
          {/* WebSocket Connection Status */}
          <Chip
            icon={experimentStatus.wsConnected ? <Wifi /> : <WifiOff />}
            label={experimentStatus.wsConnected ? "Connected" : "Disconnected"}
            color={experimentStatus.wsConnected ? "success" : "error"}
            variant="outlined"
            size="small"
          />

          <Tooltip title="Refresh experiments list">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* View Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
        <Tabs
          value={viewTab}
          onChange={(_, v) => setViewTab(v)}
          sx={{ px: 2 }}
        >
          <Tab
            icon={<Science />}
            label="Experiments"
            iconPosition="start"
            sx={{ fontWeight: 700 }}
          />
          <Tab
            icon={<Dashboard />}
            label="Grafana Dashboards"
            iconPosition="start"
            sx={{ fontWeight: 700 }}
          />
        </Tabs>
      </Paper>

      {/* Grafana Tab */}
      {viewTab === 1 && (
        <Box sx={{ mb: 3 }}>
          <GrafanaEmbed
            title="System Monitoring"
            height={600}
            showControls={true}
          />
        </Box>
      )}

      {/* Experiments Tab */}
      {viewTab === 0 && (
        loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
          {/* Left Column - Experiment Selection & Details */}
          <Grid size={{ xs: 12, lg: 8 }}>
            {/* Experiment Selector */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl sx={{ minWidth: 300 }}>
                  <InputLabel>Select Experiment</InputLabel>
                  <Select
                    value={selectedExperimentId || ""}
                    onChange={(e) => setSelectedExperimentId(Number(e.target.value) || null)}
                    label="Select Experiment"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {experiments.map((exp) => (
                      <MenuItem key={exp.id} value={exp.id}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Science sx={{ fontSize: 18 }} />
                          <span>{exp.name}</span>
                          <Chip
                            label={exp.status}
                            size="small"
                            color={
                              exp.status === "running"
                                ? "primary"
                                : exp.status === "completed"
                                ? "success"
                                : "default"
                            }
                            sx={{ height: 20, fontSize: "0.65rem" }}
                          />
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedExperimentId && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => handleAddToComparison(selectedExperimentId)}
                    disabled={comparisonIds.length >= 3 || comparisonIds.includes(selectedExperimentId)}
                  >
                    Add to Compare
                  </Button>
                )}
              </Stack>
            </Paper>

            {/* Progress Chart */}
            {selectedExperimentId ? (
              <Box sx={{ mb: 3 }}>
                {experimentStatus.isLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : experimentStatus.error ? (
                  <Alert severity="error">{experimentStatus.error}</Alert>
                ) : (
                  <RealtimeProgressChart
                    progressPercentage={experimentStatus.progressPercentage}
                    completedJobs={experimentStatus.completedJobs}
                    totalJobs={experimentStatus.totalJobs}
                    status={experimentStatus.status}
                  />
                )}
              </Box>
            ) : (
              <Paper sx={{ p: 4, mb: 3, borderRadius: 2, background: "rgba(26,32,44,0.98)", textAlign: "center" }}>
                <Science sx={{ fontSize: 48, color: "#4a9eff", mb: 2 }} />
                <Typography variant="h6" sx={{ color: "#fff", mb: 1 }}>
                  Select an Experiment
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose an experiment from the dropdown to view real-time progress and logs.
                </Typography>
              </Paper>
            )}

            {/* Live Logs */}
            {selectedExperimentId && !experimentStatus.isLoading && !experimentStatus.error && (
              <Box sx={{ height: 400 }}>
                <LiveLogViewer
                  batsimLogs={experimentStatus.batsimLogs}
                  pybatsimLogs={experimentStatus.pybatsimLogs}
                  isRunning={experimentStatus.isRunning}
                />
              </Box>
            )}
          </Grid>

          {/* Right Column - Running Experiments & Comparison */}
          <Grid size={{ xs: 12, lg: 4 }}>
            {/* Running Experiments */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
                  Running Experiments
                </Typography>
                <Chip
                  label={runningExperiments.length}
                  size="small"
                  color="primary"
                />
              </Stack>

              {runningExperiments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No experiments currently running.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {runningExperiments.map((exp) => (
                    <Card
                      key={exp.id}
                      sx={{
                        p: 1.5,
                        cursor: "pointer",
                        bgcolor:
                          selectedExperimentId === exp.id
                            ? "rgba(74,158,255,0.15)"
                            : "rgba(13,17,23,0.9)",
                        border:
                          selectedExperimentId === exp.id
                            ? "1px solid #4a9eff"
                            : "1px solid transparent",
                        "&:hover": {
                          bgcolor: "rgba(74,158,255,0.1)",
                        },
                      }}
                      onClick={() => setSelectedExperimentId(exp.id)}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ color: "#fff" }}
                            noWrap
                          >
                            {exp.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {exp.progress_percentage || 0}% • {exp.completed_jobs || 0}/{exp.total_jobs || 0} jobs
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToComparison(exp.id);
                          }}
                          disabled={comparisonIds.includes(exp.id) || comparisonIds.length >= 3}
                        >
                          <Add fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </Paper>

            {/* Comparison Panel */}
            <Paper sx={{ p: 2, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
                  Compare ({comparisonIds.length}/3)
                </Typography>
                {comparisonIds.length > 0 && (
                  <Button
                    size="small"
                    onClick={() => {
                      comparisonIds.forEach((id) => multiStatus.removeExperiment(id));
                      setComparisonIds([]);
                    }}
                  >
                    Clear All
                  </Button>
                )}
              </Stack>

              {comparisonIds.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Add experiments to compare their progress.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {comparisonIds.map((id) => {
                    const exp = experiments.find((e) => e.id === id);
                    return (
                      <Chip
                        key={id}
                        label={exp?.name || `Exp ${id}`}
                        onDelete={() => handleRemoveFromComparison(id)}
                        sx={{ justifyContent: "space-between" }}
                      />
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* Full-width Comparison View */}
          {comparisonIds.length > 0 && (
            <Grid size={12}>
              <ExperimentComparison experiments={comparisonData} />
            </Grid>
          )}
        </Grid>
        )
      )}
    </Box>
  );
};

export default MonitoringPage;
