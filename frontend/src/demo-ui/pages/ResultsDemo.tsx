import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  Drawer,
  IconButton,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
} from "@mui/material";
import {
  Assessment,
  Delete,
  Close,
  Download,
  PlayArrow,
  Refresh,
} from "@mui/icons-material";
import { mockResults, MockResult } from "../mockData";

type SortField = "experiment_name" | "created_at" | "makespan" | "resource_utilization";
type SortOrder = "asc" | "desc";

const ResultsDemo: React.FC = () => {
  const [results, setResults] = useState<MockResult[]>(mockResults);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<MockResult | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    const isAsc = sortField === field && sortOrder === "asc";
    setSortOrder(isAsc ? "desc" : "asc");
    setSortField(field);
  };

  const sortedResults = [...results].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];
    if (sortField === "created_at") {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    if (sortOrder === "asc") {
      return aVal < bVal ? -1 : 1;
    }
    return aVal > bVal ? -1 : 1;
  });

  const openDrawer = (result: MockResult) => {
    setSelectedResult(result);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedResult(null);
  };

  const handleDelete = () => {
    if (!selectedResult) return;
    setResults((prev) => prev.filter((r) => r.id !== selectedResult.id));
    setDeleteDialogOpen(false);
    closeDrawer();
    setSnackbar({ open: true, message: "Result deleted successfully!", severity: "success" });
  };

  const formatMetric = (value: number | undefined, unit: string = "") => {
    if (value === undefined || value === null) return "-";
    return `${value.toFixed(2)}${unit}`;
  };

  const getSuccessRate = (result: MockResult) => {
    if (result.total_jobs === 0) return 0;
    return ((result.completed_jobs / result.total_jobs) * 100).toFixed(1);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} gutterBottom>
            Results
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and analyze simulation results from completed experiments
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<Refresh />}
          onClick={() => setSnackbar({ open: true, message: "Results refreshed!", severity: "success" })}
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Refresh
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: "#4a9eff" }}>
              {results.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Total Results</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: "#4caf50" }}>
              {(results.reduce((acc, r) => acc + r.resource_utilization, 0) / results.length).toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">Avg Utilization</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: "#ff9800" }}>
              {(results.reduce((acc, r) => acc + r.makespan, 0) / results.length).toFixed(0)}s
            </Typography>
            <Typography variant="body2" color="text.secondary">Avg Makespan</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} color="primary">
              {results.reduce((acc, r) => acc + r.total_jobs, 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">Total Jobs</Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Table View */}
      <TableContainer component={Paper} sx={{ background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === "experiment_name"}
                  direction={sortField === "experiment_name" ? sortOrder : "asc"}
                  onClick={() => handleSort("experiment_name")}
                  sx={{ fontWeight: 700 }}
                >
                  Experiment
                </TableSortLabel>
              </TableCell>
              <TableCell>Scenario</TableCell>
              <TableCell>Strategy</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "makespan"}
                  direction={sortField === "makespan" ? sortOrder : "asc"}
                  onClick={() => handleSort("makespan")}
                  sx={{ fontWeight: 700 }}
                >
                  Makespan
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "resource_utilization"}
                  direction={sortField === "resource_utilization" ? sortOrder : "asc"}
                  onClick={() => handleSort("resource_utilization")}
                  sx={{ fontWeight: 700 }}
                >
                  Utilization
                </TableSortLabel>
              </TableCell>
              <TableCell>Jobs</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "created_at"}
                  direction={sortField === "created_at" ? sortOrder : "asc"}
                  onClick={() => handleSort("created_at")}
                  sx={{ fontWeight: 700 }}
                >
                  Date
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedResults.map((r) => (
              <TableRow
                key={r.id}
                hover
                sx={{
                  cursor: "pointer",
                  "&:hover": { background: "rgba(74,158,255,0.08)" },
                }}
                onClick={() => openDrawer(r)}
              >
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Assessment sx={{ color: "#4a9eff" }} />
                    <Typography fontWeight={600}>{r.experiment_name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip label={r.scenario_name} size="small" color="secondary" />
                </TableCell>
                <TableCell>
                  <Chip label={r.strategy_name} size="small" color="primary" />
                </TableCell>
                <TableCell>
                  <Typography fontWeight={600}>{r.makespan.toFixed(1)}s</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={`${r.resource_utilization.toFixed(1)}%`}
                    size="small"
                    color={r.resource_utilization > 80 ? "success" : r.resource_utilization > 60 ? "warning" : "error"}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {r.completed_jobs}/{r.total_jobs}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      ({getSuccessRate(r)}%)
                    </Typography>
                  </Typography>
                </TableCell>
                <TableCell>{r.created_at.split("T")[0]}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSnackbar({ open: true, message: "Download started!", severity: "success" });
                    }}
                  >
                    <Download fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Detail Panel */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{
          sx: { width: { xs: "100%", md: 480 }, p: 3, background: "#1a202c" },
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
            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" gap={0.5}>
              <Chip label={selectedResult.scenario_name} size="small" color="secondary" />
              <Chip label={selectedResult.strategy_name} size="small" color="primary" />
              <Chip label={selectedResult.created_at.split("T")[0]} size="small" />
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              <b>Key Metrics</b>
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <Card sx={{ p: 2, background: "rgba(74,158,255,0.08)", borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight={700} color="primary">
                    {selectedResult.makespan.toFixed(1)}s
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Makespan
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card sx={{ p: 2, background: "rgba(74,158,255,0.08)", borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {selectedResult.resource_utilization.toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Resource Utilization
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card sx={{ p: 2, background: "rgba(74,158,255,0.08)", borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight={700} color="warning.main">
                    {selectedResult.average_waiting_time.toFixed(1)}s
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Avg Waiting Time
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card sx={{ p: 2, background: "rgba(74,158,255,0.08)", borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight={700} color="info.main">
                    {selectedResult.average_turnaround_time.toFixed(1)}s
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Avg Turnaround
                  </Typography>
                </Card>
              </Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Job Statistics</b>
            </Typography>
            <Stack direction="row" spacing={2} mb={3}>
              <Chip label={`Total: ${selectedResult.total_jobs}`} size="small" color="default" />
              <Chip label={`Completed: ${selectedResult.completed_jobs}`} size="small" color="success" />
              <Chip label={`Failed: ${selectedResult.failed_jobs}`} size="small" color="error" />
            </Stack>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Simulation Info</b>
            </Typography>
            <Stack spacing={1} mb={3}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Simulation Time:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {selectedResult.simulation_time.toFixed(2)}s
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Success Rate:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {getSuccessRate(selectedResult)}%
                </Typography>
              </Stack>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Download />}
                onClick={() => setSnackbar({ open: true, message: "Download started!", severity: "success" })}
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                Download
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<PlayArrow />}
                onClick={() => setSnackbar({ open: true, message: "Rerun experiment queued!", severity: "success" })}
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                Rerun
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
      </Drawer>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Result</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this result? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: "#fff" }}>Cancel</Button>
          <Button onClick={handleDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ResultsDemo;
