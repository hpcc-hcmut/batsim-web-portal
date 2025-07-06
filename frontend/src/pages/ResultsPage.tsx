import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip,
  Stack,
  Button,
  Drawer,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Divider,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  Assessment,
  Delete,
  Close,
  Download,
  ExpandMore,
  Description,
  Code as CodeIcon,
  PlayArrow,
} from "@mui/icons-material";
import { resultsAPI, Result } from "../services/api";

type PanelMode = "view";

function getFileTypeIcon(fileType: string | undefined) {
  if (!fileType) return <Description sx={{ color: "#4a9eff" }} />;
  if (fileType.includes("csv")) return <CodeIcon sx={{ color: "#4a9eff" }} />;
  return <Description sx={{ color: "#4a9eff" }} />;
}

const ResultsPage: React.FC = () => {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [expandedJobs, setExpandedJobs] = useState(false);
  const [expandedSchedule, setExpandedSchedule] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await resultsAPI.getAll();
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setResults(data);
      } catch (err: any) {
        setError("Failed to load results.");
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const openDrawer = (result: Result) => {
    setSelectedResult(result);
    setDrawerOpen(true);
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
      setSnackbar({
        open: true,
        message: "Result deleted successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: "Failed to delete result.",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRerun = () => {
    // TODO: Implement rerun functionality - create new experiment with same scenario/strategy
    setSnackbar({
      open: true,
      message: "Rerun functionality coming soon!",
      severity: "success",
    });
  };

  const handleDownload = async () => {
    if (!selectedResult) return;
    try {
      // TODO: Implement proper download endpoint
      setSnackbar({
        open: true,
        message: "Download functionality coming soon!",
        severity: "success",
      });
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to download files.",
        severity: "error",
      });
    }
  };

  const formatMetric = (value: number | undefined, unit: string = "") => {
    if (value === undefined || value === null) return "-";
    return `${value.toFixed(2)}${unit}`;
  };

  const getComputedMetrics = (result: Result) => {
    if (!result.computed_metrics) return null;
    try {
      return JSON.parse(result.computed_metrics);
    } catch {
      return null;
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        height: "100%",
      }}
    >
      {/* Results List */}
      <Box sx={{ flex: 1, p: 3 }}>
        <Typography variant="h4" fontWeight={900} gutterBottom>
          Results
        </Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : error ? (
          <Typography color="error" sx={{ mt: 4 }}>
            {error}
          </Typography>
        ) : results.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 4 }}>
            No results found.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {results.map((r) => {
              const computedMetrics = getComputedMetrics(r);
              return (
                <Grid item xs={12} sm={6} md={4} key={r.id}>
                  <Card
                    sx={{
                      borderRadius: 1,
                      background: "rgba(26,32,44,0.98)",
                      height: "100%",
                      cursor: "pointer",
                      transition: "all 0.2s ease-in-out",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
                      },
                    }}
                    onClick={() => openDrawer(r)}
                  >
                    <CardContent>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        mb={2}
                      >
                        <Assessment sx={{ fontSize: 36, color: "#4a9eff" }} />
                        <Box>
                          <Typography
                            variant="h6"
                            fontWeight={900}
                            sx={{ color: "#fff" }}
                          >
                            {r.experiment_name || `Result #${r.id}`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {r.created_at?.split("T")[0]}
                          </Typography>
                        </Box>
                      </Stack>
                      {/* Important Metrics */}
                      <Stack spacing={1} mb={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Makespan:
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {formatMetric(r.makespan, "s")}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Success Rate:
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {computedMetrics?.success_rate
                              ? `${(computedMetrics.success_rate * 100).toFixed(
                                  1
                                )}%`
                              : "-"}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Jobs:
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {r.completed_jobs ?? 0}/{r.total_jobs ?? 0}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Simulation Time:
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {formatMetric(r.simulation_time, "s")}
                          </Typography>
                        </Stack>
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={r.scenario_name || "Scenario"}
                          size="small"
                          color="secondary"
                        />
                        <Chip
                          label={r.strategy_name || "Strategy"}
                          size="small"
                          color="secondary"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* Detail Panel */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{
          sx: { width: { xs: "100%", md: 420 }, p: 3, background: "#1a202c" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Typography variant="h6" fontWeight={900} sx={{ flex: 1 }}>
            {selectedResult?.experiment_name || "Result Details"}
          </Typography>
          <IconButton onClick={closeDrawer}>
            <Close />
          </IconButton>
        </Box>
        {selectedResult && (
          <>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1 }}
            >
              {getFileTypeIcon("csv")}
              <Typography variant="subtitle2" color="text.secondary">
                Result Files • {selectedResult.created_at?.split("T")[0]}
              </Typography>
              <Tooltip title="Download files">
                <IconButton size="small" onClick={handleDownload}>
                  <Download />
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing={1} mb={2}>
              <Chip
                label={selectedResult.scenario_name || "Scenario"}
                size="small"
                color="secondary"
              />
              <Chip
                label={selectedResult.strategy_name || "Strategy"}
                size="small"
                color="primary"
              />
              <Chip
                label={selectedResult.created_at?.split("T")[0]}
                size="small"
                color="default"
              />
            </Stack>
            <Divider sx={{ my: 2 }} />

            {/* Key Metrics */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Key Metrics</b>
            </Typography>
            <Stack spacing={2} mb={3}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Makespan:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatMetric(selectedResult.makespan, "s")}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Average Waiting Time:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatMetric(selectedResult.average_waiting_time, "s")}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Average Turnaround Time:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatMetric(selectedResult.average_turnaround_time, "s")}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Resource Utilization:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatMetric(selectedResult.resource_utilization, "%")}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Simulation Time:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatMetric(selectedResult.simulation_time, "s")}
                </Typography>
              </Stack>
            </Stack>

            {/* Job Statistics */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Job Statistics</b>
            </Typography>
            <Stack direction="row" spacing={2} mb={3}>
              <Chip
                label={`Total: ${selectedResult.total_jobs ?? 0}`}
                size="small"
                color="secondary"
              />
              <Chip
                label={`Completed: ${selectedResult.completed_jobs ?? 0}`}
                size="small"
                color="success"
              />
              <Chip
                label={`Failed: ${selectedResult.failed_jobs ?? 0}`}
                size="small"
                color="error"
              />
            </Stack>

            {/* Computed Metrics */}
            {getComputedMetrics(selectedResult) && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  <b>Computed Metrics</b>
                </Typography>
                <Stack direction="row" spacing={2} mb={3}>
                  <Chip
                    label={`Success Rate: ${(
                      getComputedMetrics(selectedResult)?.success_rate * 100
                    ).toFixed(1)}%`}
                    size="small"
                    color="info"
                  />
                  <Chip
                    label={`Machines: ${
                      getComputedMetrics(selectedResult)?.nb_computing_machines
                    }`}
                    size="small"
                    color="info"
                  />
                  <Chip
                    label={`Energy: ${getComputedMetrics(
                      selectedResult
                    )?.consumed_joules.toFixed(0)}J`}
                    size="small"
                    color="info"
                  />
                </Stack>
              </>
            )}

            {/* Data Files */}
            <Accordion
              expanded={expandedJobs}
              onChange={() => setExpandedJobs((v) => !v)}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>Jobs Data</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ maxHeight: 180, overflow: "auto" }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>
                    {selectedResult.jobs_data || "No jobs data available"}
                  </pre>
                </Box>
              </AccordionDetails>
            </Accordion>
            <Accordion
              expanded={expandedSchedule}
              onChange={() => setExpandedSchedule((v) => !v)}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>Schedule Data</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ maxHeight: 180, overflow: "auto" }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>
                    {selectedResult.schedule_data ||
                      "No schedule data available"}
                  </pre>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Stack direction="row" spacing={2} mt={3}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<PlayArrow />}
                onClick={handleRerun}
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                Rerun Experiment
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => setDeleteDialogOpen(true)}
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                Delete
              </Button>
            </Stack>
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete Result</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this result? This action cannot be
              undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              color="error"
              disabled={actionLoading}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for feedback */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Drawer>
    </Box>
  );
};

export default ResultsPage;
