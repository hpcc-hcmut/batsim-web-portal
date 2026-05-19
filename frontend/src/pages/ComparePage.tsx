import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Typography,
  Paper,
  Button,
  Chip,
  Stack,
  Alert,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  SelectChangeEvent,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { CompareArrows } from "@mui/icons-material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Radar } from "react-chartjs-2";
import { Experiment, experimentsAPI, resultsAPI } from "../services/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
);

const METRIC_LABELS: Record<string, string> = {
  makespan: "Makespan (s)",
  average_waiting_time: "Avg Waiting Time (s)",
  average_turnaround_time: "Avg Turnaround Time (s)",
  mean_slowdown: "Mean Slowdown",
  max_slowdown: "Max Slowdown",
  resource_utilization: "Resource Utilization",
  throughput: "Throughput (jobs/s)",
  success_rate: "Success Rate",
  max_waiting_time: "Max Waiting Time (s)",
  max_turnaround_time: "Max Turnaround Time (s)",
  total_jobs: "Total Jobs",
  completed_jobs: "Completed Jobs",
  failed_jobs: "Failed Jobs",
  simulation_time: "Simulation Time (s)",
  consumed_joules: "Energy (Joules)",
};

// Metrics to hide from table when all selected experiments report 0
// (typically signals BatSim feature not enabled, e.g., energy simulation)
const HIDE_IF_ALL_ZERO = ["consumed_joules"];

// Metrics shown in chart panels — ordered by diagnostic importance for case study
const CHART_METRICS = [
  "makespan",
  "average_waiting_time",
  "average_turnaround_time",
  "mean_slowdown",
  "max_slowdown",
  "resource_utilization",
];

// Metrics where lower value is better — affects "best" highlighting + normalization direction
const LOWER_IS_BETTER = new Set([
  "makespan",
  "average_waiting_time",
  "average_turnaround_time",
  "mean_slowdown",
  "max_slowdown",
  "max_waiting_time",
  "max_turnaround_time",
  "failed_jobs",
  "simulation_time",
]);

const COLORS = [
  "#4a9eff", "#ff6b6b", "#51cf66", "#ffd43b", "#cc5de8",
  "#20c997", "#ff922b", "#845ef7", "#339af0", "#f06595",
];

const ComparePage: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparison, setComparison] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    experimentsAPI.getAll().then((res) => {
      // Only show completed experiments
      setExperiments(res.data.filter((e) => e.status === "completed"));
    });
  }, []);

  const handleSelectionChange = (event: SelectChangeEvent<number[]>) => {
    const val = event.target.value;
    setSelectedIds(typeof val === "string" ? val.split(",").map(Number) : val);
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      setError("Select at least 2 experiments to compare");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await resultsAPI.compare(selectedIds);
      setComparison(res.data.experiments);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const completedExperiments = comparison ? comparison.filter((e) => e.has_result) : [];

  // Build per-metric chart data — one Bar chart per metric (Phase 1 Option B: multi-panel)
  const perMetricBarData = (metric: string) => ({
    labels: completedExperiments.map((exp) => exp.experiment_name),
    datasets: [
      {
        label: METRIC_LABELS[metric] || metric,
        data: completedExperiments.map((exp) => exp[metric] ?? 0),
        backgroundColor: completedExperiments.map((_, i) => COLORS[i % COLORS.length]),
        borderRadius: 4,
      },
    ],
  });

  // Build radar chart data — normalized 0-1 across strategies per metric (Phase 1 Option C)
  // Inverted for "lower is better" metrics so larger area = better strategy overall
  const radarData = (() => {
    if (completedExperiments.length === 0) return null;
    const axes = CHART_METRICS;
    const normalize = (metric: string, value: number) => {
      const values = completedExperiments.map((e) => Number(e[metric]) || 0);
      const max = Math.max(...values);
      const min = Math.min(...values);
      if (max === min) return 1; // all equal — flat at 1
      const norm = (value - min) / (max - min);
      // Invert so "better strategy" → larger axis value (radar polygon bigger)
      return LOWER_IS_BETTER.has(metric) ? 1 - norm : norm;
    };
    return {
      labels: axes.map((m) => METRIC_LABELS[m] || m),
      datasets: completedExperiments.map((exp, i) => ({
        label: exp.experiment_name,
        data: axes.map((m) => normalize(m, Number(exp[m]) || 0)),
        backgroundColor: `${COLORS[i % COLORS.length]}33`, // ~20% opacity
        borderColor: COLORS[i % COLORS.length],
        borderWidth: 2,
        pointBackgroundColor: COLORS[i % COLORS.length],
      })),
    };
  })();

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <CompareArrows sx={{ fontSize: 32, color: "#4a9eff" }} />
        <Typography variant="h4" fontWeight={900}>
          Compare Experiments
        </Typography>
      </Stack>

      {/* Experiment Selector */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" gap={1}>
          <FormControl sx={{ minWidth: 400 }}>
            <InputLabel>Select Experiments</InputLabel>
            <Select
              multiple
              value={selectedIds}
              onChange={handleSelectionChange}
              input={<OutlinedInput label="Select Experiments" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((id) => {
                    const exp = experiments.find((e) => e.id === id);
                    return <Chip key={id} label={exp?.name || `#${id}`} size="small" />;
                  })}
                </Box>
              )}
            >
              {experiments.map((exp) => (
                <MenuItem key={exp.id} value={exp.id}>
                  #{exp.id} — {exp.name} ({exp.strategy_name})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={handleCompare}
            disabled={selectedIds.length < 2 || loading}
            startIcon={<CompareArrows />}
          >
            {loading ? "Comparing..." : "Compare"}
          </Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      {/* Comparison Results */}
      {comparison && (
        <>
          {/* Metrics Table */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Metrics Comparison
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Metric</TableCell>
                    {comparison.map((exp) => (
                      <TableCell key={exp.experiment_id} sx={{ fontWeight: 700 }} align="right">
                        {exp.experiment_name}
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {exp.strategy_name}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(METRIC_LABELS).map(([key, label]) => {
                    const values = comparison.map((e) => e[key]).filter((v) => v != null);
                    if (values.length === 0) return null;
                    // Hide rows where all values are 0 for metrics that signal "feature off"
                    if (HIDE_IF_ALL_ZERO.includes(key) && values.every((v) => v === 0)) return null;
                    const best = LOWER_IS_BETTER.has(key)
                      ? Math.min(...values)
                      : Math.max(...values);
                    return (
                      <TableRow key={key}>
                        <TableCell>{label}</TableCell>
                        {comparison.map((exp) => {
                          const val = exp[key];
                          const isBest = val != null && val === best && values.length > 1;
                          return (
                            <TableCell
                              key={exp.experiment_id}
                              align="right"
                              sx={{ fontWeight: isBest ? 700 : 400, color: isBest ? "#51cf66" : "inherit" }}
                            >
                              {val != null ? (typeof val === "number" ? val.toFixed(4) : val) : "—"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Per-metric Bar Charts — each metric gets its own panel with own Y-axis scale */}
          {completedExperiments.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Visual Comparison — Per Metric
              </Typography>
              <Grid container spacing={2}>
                {CHART_METRICS.map((metric) => {
                  const values = completedExperiments
                    .map((e) => e[metric])
                    .filter((v) => v != null);
                  if (values.length === 0) return null;
                  if (HIDE_IF_ALL_ZERO.includes(metric) && values.every((v) => v === 0)) {
                    return null;
                  }
                  return (
                    <Grid item xs={12} sm={6} md={4} key={metric}>
                      <Box sx={{ height: 220 }}>
                        <Bar
                          data={perMetricBarData(metric)}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false },
                              title: {
                                display: true,
                                text: METRIC_LABELS[metric] || metric,
                                color: "#e2e8f0",
                                font: { size: 13, weight: "bold" },
                              },
                              tooltip: {
                                callbacks: {
                                  label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`,
                                },
                              },
                            },
                            scales: {
                              x: {
                                ticks: { color: "#a0aec0", maxRotation: 30, minRotation: 0 },
                                grid: { color: "#2d3748" },
                              },
                              y: {
                                ticks: { color: "#a0aec0" },
                                grid: { color: "#2d3748" },
                                beginAtZero: true,
                              },
                            },
                          }}
                        />
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Paper>
          )}

          {/* Radar Chart — normalized 0-1 with "lower is better" inverted so larger area = better strategy.
              Comment out this Paper block if radar visualization adds noise rather than insight. */}
          {radarData && completedExperiments.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Visual Comparison — Radar (Normalized)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Each axis is normalized to [0, 1] across the strategies being compared. Metrics where
                "lower is better" (waiting, turnaround, slowdown, makespan) are inverted, so a larger
                polygon area indicates a better strategy overall.
              </Typography>
              <Box sx={{ height: 420, maxWidth: 600, mx: "auto" }}>
                <Radar
                  data={radarData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "top", labels: { color: "#e2e8f0" } },
                    },
                    scales: {
                      r: {
                        beginAtZero: true,
                        suggestedMin: 0,
                        suggestedMax: 1,
                        ticks: { color: "#a0aec0", backdropColor: "transparent", stepSize: 0.2 },
                        grid: { color: "#2d3748" },
                        angleLines: { color: "#2d3748" },
                        pointLabels: { color: "#e2e8f0", font: { size: 11 } },
                      },
                    },
                  }}
                />
              </Box>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default ComparePage;
