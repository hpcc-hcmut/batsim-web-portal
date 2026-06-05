import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Button,
  Stack,
  Chip,
  Alert,
  Snackbar,
  LinearProgress,
} from "@mui/material";
import { PlayArrow, Stop, Add, Replay } from "@mui/icons-material";
import {
  experimentsAPI,
  Experiment,
  scenariosAPI,
  strategiesAPI,
  Scenario,
  Strategy,
} from "../services/api";
import { ExperimentCreateDialog } from "../components/experiments/experiment-create-dialog";
import { ExperimentDetailDialog } from "../components/experiments/experiment-detail-dialog";
import { formatRelativeTime } from "../utils/format-relative-time";
import { SortMenu } from "../components/common/sort-menu";
import { PaginationFooter } from "../components/common/pagination-footer";
import { useListQueryParams } from "../utils/use-list-query-params";
import { EXPERIMENT_SORTS } from "../config/sort-options";

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

// Auto-refresh interval for running experiments (ms)
const AUTO_REFRESH_INTERVAL = 5000;

const ExperimentsPage: React.FC = () => {
  const { sort, order, page, size, skip, update } = useListQueryParams();
  const [total, setTotal] = useState(0);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const fetchExperiments = useCallback(async () => {
    try {
      const res = await experimentsAPI.getAll({ sort_by: sort, order, skip, limit: size });
      const data = Array.isArray(res.data) ? res.data : (res.data as any).items || [];
      setExperiments(data);
      setTotal(Number(res.headers["x-total-count"] ?? data.length));
      // Update selected experiment if detail dialog is open
      if (selectedExperiment) {
        const updated = data.find((e: Experiment) => e.id === selectedExperiment.id);
        if (updated) setSelectedExperiment(updated);
      }
    } catch {
      setError("Failed to load experiments.");
    }
  }, [selectedExperiment, sort, order, skip, size]);

  // Initial load + on sort/page change
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchExperiments().finally(() => setLoading(false));
  }, [sort, order, skip, size]);

  // Auto-refresh when any experiment is running/queued
  useEffect(() => {
    const hasActive = experiments.some((e) => e.status === "running" || e.status === "queued");
    if (!hasActive) return;
    const interval = setInterval(fetchExperiments, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [experiments, fetchExperiments]);

  // Fetch scenarios and strategies for create dialog
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Dialog dropdowns need all entities — bypass default 20-item pagination
        const [scenariosRes, strategiesRes] = await Promise.all([
          scenariosAPI.getAll({ limit: 1000 }),
          strategiesAPI.getAll({ limit: 1000 }),
        ]);
        setScenarios(scenariosRes.data);
        setStrategies(strategiesRes.data);
      } catch {
        console.error("Failed to fetch scenarios/strategies");
      }
    };
    fetchData();
  }, []);

  const handleStart = async (id: number) => {
    try {
      await experimentsAPI.start(id);
      setSnackbar({ open: true, message: "Experiment started!", severity: "success" });
      fetchExperiments();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || "Failed to start experiment.",
        severity: "error",
      });
    }
  };

  const handleStop = async (id: number) => {
    try {
      await experimentsAPI.stop(id);
      setSnackbar({ open: true, message: "Experiment stopped.", severity: "success" });
      fetchExperiments();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || "Failed to stop experiment.",
        severity: "error",
      });
    }
  };

  // Rerun: backend clones the frozen inputs into a new experiment and starts it
  const handleRerun = async (id: number) => {
    try {
      const res = await experimentsAPI.rerun(id);
      setSnackbar({
        open: true,
        message: `Rerun started: ${res.data.name}`,
        severity: "success",
      });
      fetchExperiments();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || "Failed to rerun experiment.",
        severity: "error",
      });
    }
  };

  const handleSnackbar = (message: string, severity: "success" | "error") => {
    setSnackbar({ open: true, message, severity });
  };

  if (loading) {
    return (
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight={900}>Experiments</Typography>
          <Button variant="contained" startIcon={<Add />} disabled>New Experiment</Button>
        </Stack>
        <Grid container spacing={3}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={900}>Experiments</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <SortMenu
            options={EXPERIMENT_SORTS}
            value={`${sort}:${order}`}
            onChange={(s, o) => update({ sort: s, order: o, page: 1 })}
          />
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateDialogOpen(true)}>
            New Experiment
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {experiments.length === 0 ? (
        <Typography color="text.secondary">No experiments yet. Create one to get started.</Typography>
      ) : (
        <Grid container spacing={3}>
          {experiments.map((e) => (
            <Grid key={e.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{ cursor: "pointer", "&:hover": { boxShadow: 6 }, height: "100%" }}
                onClick={() => { setSelectedExperiment(e); setDetailDialogOpen(true); }}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="h6" fontWeight={700} noWrap sx={{ maxWidth: "70%" }}>
                      {e.name}
                    </Typography>
                    <Chip label={e.status} color={getStatusColor(e.status)} size="small" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {e.description || "No description provided."}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" gap={0.5}>
                    <Chip label={formatRelativeTime(e.created_at)} size="small" />
                    <Chip label={e.scenario_name || "Scenario"} size="small" color="secondary" />
                    <Chip label={e.strategy_name || "Strategy"} size="small" color="secondary" />
                  </Stack>

                  {e.status === "running" && (
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress
                        variant="determinate"
                        value={e.progress_percentage || 0}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                        {e.progress_percentage || 0}% Complete
                      </Typography>
                    </Box>
                  )}

                  {e.status === "failed" && e.error_message && (
                    <Typography variant="caption" color="error" sx={{ mb: 1, display: "block" }}>
                      Error: {e.error_message.substring(0, 80)}...
                    </Typography>
                  )}

                  {e.status === "pending" && (
                    <Button variant="contained" color="success" size="small" startIcon={<PlayArrow />}
                      onClick={(event) => { event.stopPropagation(); handleStart(e.id); }} sx={{ mr: 1 }}>
                      Start
                    </Button>
                  )}
                  {(e.status === "running" || e.status === "queued") && (
                    <Button variant="contained" color="error" size="small" startIcon={<Stop />}
                      onClick={(event) => { event.stopPropagation(); handleStop(e.id); }}>
                      {e.status === "queued" ? "Cancel" : "Stop"}
                    </Button>
                  )}
                  {(e.status === "completed" || e.status === "failed" || e.status === "cancelled") && (
                    <Button variant="outlined" color="primary" size="small" startIcon={<Replay />}
                      title="Rerun from frozen inputs (creates a new experiment)"
                      onClick={(event) => { event.stopPropagation(); handleRerun(e.id); }}>
                      Rerun
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      {!loading && !error && (
        <PaginationFooter
          page={page}
          size={size}
          total={total}
          onPageChange={(p) => update({ page: p })}
          onSizeChange={(s) => update({ size: s, page: 1 })}
        />
      )}

      <ExperimentCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={fetchExperiments}
        scenarios={scenarios}
        strategies={strategies}
        onSnackbar={handleSnackbar}
      />

      <ExperimentDetailDialog
        open={detailDialogOpen}
        experiment={selectedExperiment}
        onClose={() => setDetailDialogOpen(false)}
        onStart={handleStart}
        onStop={handleStop}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExperimentsPage;
