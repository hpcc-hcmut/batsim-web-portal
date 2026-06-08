import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Chip,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from "@mui/material";
import { Assessment } from "@mui/icons-material";
import { resultsAPI, experimentsAPI, Result, Experiment } from "../services/api";
import { ExperimentDetailDialog } from "../components/experiments/experiment-detail-dialog";
import { useViewMode } from "../utils/use-view-mode";
import { ViewToggle } from "../components/common/view-toggle";
import { EntityListTable } from "../components/common/entity-list-table";
import ResultDetailDrawer, {
  formatMetric,
  getComputedMetrics,
} from "../components/results/result-detail-drawer";
import { formatRelativeTime } from "../utils/format-relative-time";
import { SortMenu } from "../components/common/sort-menu";
import { PaginationFooter } from "../components/common/pagination-footer";
import { useListQueryParams } from "../utils/use-list-query-params";
import { RESULT_SORTS } from "../config/sort-options";

const ResultsPage: React.FC = () => {
  const { sort, order, page, size, skip, update } = useListQueryParams();
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useViewMode("results");
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await resultsAPI.getAll({ sort_by: sort, order, skip, limit: size });
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setResults(data);
        setTotal(Number(res.headers["x-total-count"] ?? data.length));
      } catch {
        setError("Failed to load results.");
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [sort, order, skip, size]);

  const openDrawer = (result: Result) => {
    setSelectedResult(result);
    setDrawerOpen(true);
    // List response uses load_only (no jobs_data/schedule_data blobs).
    // Fetch full record so Summary tab's raw accordions have data.
    resultsAPI.getById(result.id).then((res) => setSelectedResult(res.data)).catch(() => {});
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedResult(null);
  };

  const handleDelete = async () => {
    if (!selectedResult) return;
    setActionLoading(true);
    try {
      await resultsAPI.delete(selectedResult.id);
      setResults((prev) => prev.filter((r) => r.id !== selectedResult.id));
      setDeleteDialogOpen(false);
      closeDrawer();
      setSnackbar({ open: true, message: "Result deleted successfully!", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Failed to delete result.", severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  // "Which config produced this result?" — open the source experiment detail
  const [viewedExperiment, setViewedExperiment] = useState<Experiment | null>(null);
  const handleViewExperiment = async () => {
    if (!selectedResult?.experiment_id) return;
    try {
      const res = await experimentsAPI.getById(selectedResult.experiment_id);
      setViewedExperiment(res.data);
    } catch {
      setSnackbar({
        open: true,
        message: "Source experiment not found (it may have been deleted).",
        severity: "error",
      });
    }
  };

  // Rerun via the result's source experiment: backend clones the frozen
  // inputs into a new experiment and auto-starts it.
  const handleRerun = async () => {
    if (!selectedResult?.experiment_id) return;
    setActionLoading(true);
    try {
      const res = await experimentsAPI.rerun(selectedResult.experiment_id);
      setSnackbar({
        open: true,
        message: `Rerun started: ${res.data.name}`,
        severity: "success",
      });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || "Failed to rerun experiment.",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async (format: "json" | "csv" = "json") => {
    if (!selectedResult) return;
    try {
      const res = await resultsAPI.exportResult(selectedResult.id, format);
      const blob = new Blob([res.data], {
        type: format === "csv" ? "text/csv" : "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `experiment_${selectedResult.experiment_id}_${format === "csv" ? "jobs.csv" : "metrics.json"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSnackbar({ open: true, message: `Downloaded ${format.toUpperCase()} successfully!`, severity: "success" });
    } catch {
      setSnackbar({ open: true, message: `Failed to download ${format.toUpperCase()} file.`, severity: "error" });
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, height: "100%" }}>
      <Box sx={{ flex: 1, p: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={2} sx={{ mb: 2, width: "100%" }}>
          <Typography variant="h4" fontWeight={900}>
            Results
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <ViewToggle value={viewMode} onChange={setViewMode} />
            <SortMenu
              options={RESULT_SORTS}
              value={`${sort}:${order}`}
              onChange={(s, o) => update({ sort: s, order: o, page: 1 })}
            />
          </Stack>
        </Stack>
        {loading ? (
          <Grid container spacing={3}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1 }} />
              </Grid>
            ))}
          </Grid>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>
        ) : results.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 4 }}>No results yet — run an experiment to generate one.</Typography>
        ) : viewMode === "list" ? (
          <EntityListTable
            rows={results}
            rowKey={(r) => r.id}
            onRowClick={openDrawer}
            columns={[
              {
                key: "experiment", label: "Experiment",
                render: (r) => (
                  <Typography variant="body2" fontWeight={600} noWrap title={r.experiment_name || `Result #${r.id}`}>
                    {r.experiment_name || `Result #${r.id}`}
                  </Typography>
                ),
              },
              { key: "strategy", label: "Strategy", render: (r) => r.strategy_name || "-" },
              { key: "makespan", label: "Makespan", align: "right", render: (r) => formatMetric(r.makespan, "s") },
              {
                key: "success", label: "Success", align: "right",
                render: (r) => {
                  const cm = getComputedMetrics(r);
                  return cm?.success_rate != null ? `${(cm.success_rate * 100).toFixed(1)}%` : "-";
                },
              },
              {
                key: "jobs", label: "Jobs", align: "right",
                render: (r) => `${r.completed_jobs ?? 0}/${r.total_jobs ?? 0}`,
              },
              {
                key: "created", label: "Created",
                render: (r) => (
                  <Typography variant="caption" color="text.secondary">
                    {formatRelativeTime(r.created_at)}
                  </Typography>
                ),
              },
            ]}
          />
        ) : (
          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))" }}>
            {results.map((r) => {
              const cm = getComputedMetrics(r);
              return (
                  <Card
                    key={r.id}
                    sx={{
                      borderRadius: 1,
                      background: "rgba(26,32,44,0.98)",
                      height: "100%",
                      cursor: "pointer",
                      transition: "transform 150ms ease, box-shadow 150ms ease",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 8px 24px 0 rgba(0,0,0,0.4)",
                      },
                    }}
                    onClick={() => openDrawer(r)}
                  >
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                        <Assessment sx={{ fontSize: 36, color: "#4a9eff" }} />
                        <Box>
                          <Typography variant="h6" fontWeight={900} sx={{ color: "#fff" }}>
                            {r.experiment_name || `Result #${r.id}`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatRelativeTime(r.created_at)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack spacing={1} mb={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">Makespan:</Typography>
                          <Typography variant="body2" fontWeight={600}>{formatMetric(r.makespan, "s")}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">Success Rate:</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {cm?.success_rate ? `${(cm.success_rate * 100).toFixed(1)}%` : "-"}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">Utilization:</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {r.resource_utilization != null
                              ? `${(r.resource_utilization * 100).toFixed(1)}%`
                              : "-"}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">Jobs:</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {r.completed_jobs ?? 0}/{r.total_jobs ?? 0}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">Simulation Time:</Typography>
                          <Typography variant="body2" fontWeight={600}>{formatMetric(r.simulation_time, "s")}</Typography>
                        </Stack>
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Chip label={r.scenario_name || "Scenario"} size="small" color="secondary" />
                        <Chip label={r.strategy_name || "Strategy"} size="small" color="secondary" />
                      </Stack>
                    </CardContent>
                  </Card>
              );
            })}
          </Box>
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
      </Box>

      <ResultDetailDrawer
        open={drawerOpen}
        result={selectedResult}
        onClose={closeDrawer}
        onDelete={() => setDeleteDialogOpen(true)}
        onRerun={handleRerun}
        onDownload={handleDownload}
        onViewExperiment={handleViewExperiment}
      />

      {/* Source experiment of the open result. Results only exist for finished
          runs, so Start/Stop actions never render here — no-op handlers are safe */}
      <ExperimentDetailDialog
        open={viewedExperiment != null}
        experiment={viewedExperiment}
        onClose={() => setViewedExperiment(null)}
        onStart={() => {}}
        onStop={() => {}}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Result</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this result? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading}>Cancel</Button>
          <Button onClick={handleDelete} color="error" disabled={actionLoading}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ResultsPage;
