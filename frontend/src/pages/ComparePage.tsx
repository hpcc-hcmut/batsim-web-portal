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
  Autocomplete,
  TextField,
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
import { CompareArrows, Download } from "@mui/icons-material";
import { downloadCsv, CsvColumn } from "../utils/export-csv";
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
import WaitingCdfOverlay from "../components/compare/waiting-cdf-overlay";
import PerJobScatter from "../components/compare/per-job-scatter";
import { ChartExportButton } from "../components/common/chart-export-button";
import { exportCanvasPng } from "../utils/export-chart-png";

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

/**
 * Delta-vs-baseline cell styling ("heatmap table"): green tint when the value
 * beats the baseline for that metric's direction, red when worse. Tint
 * intensity scales with |delta%|, capped at 40% so outliers don't blind.
 */
function deltaCell(
  key: string,
  val: unknown,
  base: unknown,
): { bg?: string; pct?: string } {
  if (typeof val !== "number" || typeof base !== "number" || base === 0) return {};
  const delta = (val - base) / Math.abs(base);
  if (Math.abs(delta) < 0.005) return {}; // effectively equal - no noise
  const better = LOWER_IS_BETTER.has(key) ? delta < 0 : delta > 0;
  const alpha = 0.05 + Math.min(Math.abs(delta) / 0.4, 1) * 0.22;
  return {
    bg: better ? `rgba(81,207,102,${alpha})` : `rgba(255,107,107,${alpha})`,
    pct: `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`,
  };
}

const ComparePage: React.FC = () => {
  // Chart instances for PNG export (bars keyed by metric)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barRefs = React.useRef<Record<string, any>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const radarRef = React.useRef<any>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparison, setComparison] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Picker needs all completed experiments — bypass default 20-item pagination
    experimentsAPI.getAll({ limit: 1000 }).then((res) => {
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

  // Strategy-first label (Comparison is about strategies, not run names);
  // falls back to appending the experiment name when two columns would collide
  const displayLabel = (exp: any): string => {
    const tag = (e: any) =>
      `${e.strategy_name || "?"}${e.frozen_strategy_version ? ` v${e.frozen_strategy_version}` : ""}`;
    const base = tag(exp);
    const dup = completedExperiments.filter((e) => tag(e) === base).length > 1;
    return dup ? `${base} (${exp.experiment_name})` : base;
  };

  // One fixed color per compared experiment, used consistently across
  // table chips, bars, radar and the CDF overlay
  const colorOf = (exp: any): string => {
    const idx = completedExperiments.findIndex((e) => e.experiment_id === exp.experiment_id);
    return idx >= 0 ? COLORS[idx % COLORS.length] : "#6b7280";
  };

  // Comparability check on FROZEN workload identity (what actually ran)
  const workloadKeys = completedExperiments.map((e) =>
    e.frozen_workload_name ? `${e.frozen_workload_name} (v${e.frozen_workload_version})` : null,
  );
  const knownWorkloads = new Set(workloadKeys.filter(Boolean) as string[]);
  const sameWorkload =
    completedExperiments.length > 0 &&
    knownWorkloads.size === 1 &&
    workloadKeys.every(Boolean);
  const mixedWorkloads = knownWorkloads.size > 1;

  const baseline = completedExperiments[0] ?? null;

  // CSV export — flat row per experiment, columns = id/meta + every numeric metric.
  // Null values stay empty so Excel doesn't render "0" for "not measured".
  const handleExportCsv = () => {
    if (!completedExperiments.length) return;
    const columns: CsvColumn<Record<string, unknown>>[] = [
      { key: "experiment_id", header: "experiment_id" },
      { key: "experiment_name", header: "experiment_name" },
      { key: "scenario_name", header: "scenario" },
      { key: "strategy_name", header: "strategy" },
      { key: "seed", header: "seed" },
      ...Object.keys(METRIC_LABELS).map<CsvColumn<Record<string, unknown>>>((key) => ({
        key,
        header: METRIC_LABELS[key] || key,
        format: (v) => (v === null || v === undefined ? "" : v as string | number),
      })),
    ];
    const date = new Date().toISOString().slice(0, 10);
    const ids = selectedIds.join("-");
    downloadCsv(completedExperiments as Record<string, unknown>[], columns, `comparison-${date}-${ids}.csv`);
  };

  // Build per-metric chart data — one Bar chart per metric (Phase 1 Option B: multi-panel)
  const perMetricBarData = (metric: string) => ({
    labels: completedExperiments.map((exp) => displayLabel(exp)),
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
        label: displayLabel(exp),
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
          Experiment Comparison
        </Typography>
      </Stack>

      {/* Experiment Selector */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" gap={1}>
          {/* Autocomplete: type-to-filter the experiment list (tester feedback).
              `experiments` is already pre-filtered to completed runs on load. */}
          <Autocomplete
            multiple
            sx={{ minWidth: 400 }}
            options={experiments}
            getOptionLabel={(e) => `#${e.id} — ${e.name} (${e.strategy_name})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={experiments.filter((e) => selectedIds.includes(e.id))}
            onChange={(_, val) => setSelectedIds(val.map((e) => e.id))}
            filterSelectedOptions
            renderInput={(params) => (
              <TextField {...params} label="Select Experiments" placeholder="Gõ để lọc…" />
            )}
          />
          <Button
            variant="contained"
            onClick={handleCompare}
            disabled={selectedIds.length < 2 || loading}
            startIcon={<CompareArrows />}
          >
            {loading ? "Comparing..." : "Compare"}
          </Button>
          <Button
            variant="outlined"
            onClick={handleExportCsv}
            disabled={!completedExperiments.length}
            startIcon={<Download />}
          >
            Export CSV
          </Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      {/* Empty state — first visit guidance instead of a blank page */}
      {!comparison && !loading && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center", bgcolor: "transparent" }}>
          <CompareArrows sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">
            Pick 2 or more completed experiments above, then press Compare.
          </Typography>
          <Typography variant="caption" color="text.disabled">
            You get a side-by-side metrics table, per-metric bar charts and a radar overview. Export to CSV anytime.
          </Typography>
        </Paper>
      )}

      {/* Comparison Results */}
      {comparison && (
        <>
          {/* Comparability badge: comparing metrics across different workloads
              is apples-vs-oranges - warn loudly, but do not block */}
          {sameWorkload && (
            <Chip
              color="success"
              variant="outlined"
              size="small"
              label={`Same workload: ${workloadKeys[0]}`}
              sx={{ mb: 2 }}
            />
          )}
          {mixedWorkloads && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              These experiments ran on different workloads ({[...knownWorkloads].join(" / ")}).
              Metrics are not directly comparable.
            </Alert>
          )}

          {/* Metrics Table */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Metrics Comparison
            </Typography>
            {baseline && completedExperiments.length > 1 && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Cells are tinted vs the baseline (first column): green = better, red = worse.
              </Typography>
            )}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Metric</TableCell>
                    {comparison.map((exp) => (
                      <TableCell key={exp.experiment_id} sx={{ fontWeight: 700 }} align="right">
                        {exp.experiment_name}
                        {baseline && exp.experiment_id === baseline.experiment_id && (
                          <Typography component="span" variant="caption" color="text.secondary">
                            {" "}(baseline)
                          </Typography>
                        )}
                        <br />
                        {/* Strategy identity chip - same color as this experiment's
                            bars/radar/CDF lines so charts read without legends */}
                        <Chip
                          size="small"
                          label={displayLabel(exp)}
                          sx={{
                            height: 20,
                            fontWeight: 600,
                            color: colorOf(exp),
                            bgcolor: `${colorOf(exp)}1f`,
                            border: `1px solid ${colorOf(exp)}66`,
                          }}
                        />
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
                          // Delta tint vs baseline column (skip the baseline itself)
                          const d =
                            baseline && exp.experiment_id !== baseline.experiment_id
                              ? deltaCell(key, val, baseline[key])
                              : {};
                          return (
                            <TableCell
                              key={exp.experiment_id}
                              align="right"
                              sx={{
                                fontWeight: isBest ? 700 : 400,
                                color: isBest ? "#51cf66" : "inherit",
                                bgcolor: d.bg,
                              }}
                            >
                              {val != null ? (typeof val === "number" ? val.toFixed(4) : val) : "—"}
                              {d.pct && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {d.pct}
                                </Typography>
                              )}
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
                      <Box sx={{ height: 220, position: "relative" }}>
                        <ChartExportButton
                          onExport={() => {
                            const c = barRefs.current[metric];
                            if (c) exportCanvasPng(c.canvas, `compare-${metric}`);
                          }}
                        />
                        <Bar
                          ref={(instance) => {
                            barRefs.current[metric] = instance;
                          }}
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
              <Box sx={{ height: 420, maxWidth: 600, mx: "auto", position: "relative" }}>
                <ChartExportButton
                  onExport={() =>
                    radarRef.current && exportCanvasPng(radarRef.current.canvas, "compare-radar")
                  }
                />
                <Radar
                  ref={(instance) => {
                    radarRef.current = instance;
                  }}
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

          {/* Waiting-time CDF overlay - one stepped line per strategy, shared axes */}
          {completedExperiments.some((e) => e.result_id) && (
            <Box sx={{ mt: 3 }}>
              <WaitingCdfOverlay
                entries={completedExperiments
                  .filter((e) => e.result_id)
                  .map((e) => ({
                    resultId: e.result_id as number,
                    label: displayLabel(e),
                    color: colorOf(e),
                  }))}
              />
            </Box>
          )}

          {/* Per-job scatter - unlocked for exactly 2 runs on the SAME frozen workload */}
          {completedExperiments.length === 2 &&
            completedExperiments.every((e) => e.result_id) &&
            (sameWorkload ? (
              <PerJobScatter
                a={{
                  resultId: completedExperiments[0].result_id as number,
                  label: displayLabel(completedExperiments[0]),
                  color: colorOf(completedExperiments[0]),
                }}
                b={{
                  resultId: completedExperiments[1].result_id as number,
                  label: displayLabel(completedExperiments[1]),
                  color: colorOf(completedExperiments[1]),
                }}
              />
            ) : (
              <Alert severity="info" sx={{ mb: 3 }}>
                Per-job comparison requires both experiments to share the same frozen workload.
              </Alert>
            ))}
          {completedExperiments.length > 2 && (
            <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 3 }}>
              Tip: select exactly 2 experiments to unlock the per-job scatter comparison.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};

export default ComparePage;
