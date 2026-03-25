import React, { useState, useEffect } from "react";
import {
  Box,
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
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Experiment, experimentsAPI, resultsAPI } from "../services/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const METRIC_LABELS: Record<string, string> = {
  makespan: "Makespan (s)",
  average_waiting_time: "Avg Waiting Time (s)",
  average_turnaround_time: "Avg Turnaround Time (s)",
  resource_utilization: "Resource Utilization",
  total_jobs: "Total Jobs",
  completed_jobs: "Completed Jobs",
  failed_jobs: "Failed Jobs",
  simulation_time: "Simulation Time (s)",
  max_waiting_time: "Max Waiting Time (s)",
  max_turnaround_time: "Max Turnaround Time (s)",
  mean_slowdown: "Mean Slowdown",
  success_rate: "Success Rate",
  throughput: "Throughput (jobs/s)",
  consumed_joules: "Energy (Joules)",
};

const CHART_METRICS = [
  "makespan",
  "average_waiting_time",
  "average_turnaround_time",
  "resource_utilization",
  "mean_slowdown",
];

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

  const chartData = comparison
    ? {
        labels: CHART_METRICS.map((m) => METRIC_LABELS[m] || m),
        datasets: comparison
          .filter((e) => e.has_result)
          .map((exp, i) => ({
            label: exp.experiment_name,
            data: CHART_METRICS.map((m) => exp[m] ?? 0),
            backgroundColor: COLORS[i % COLORS.length],
            borderRadius: 4,
          })),
      }
    : null;

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
                    const best = key === "failed_jobs" ? Math.min(...values) :
                                 key === "resource_utilization" || key === "success_rate" || key === "throughput"
                                   ? Math.max(...values) : Math.min(...values);
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

          {/* Bar Chart */}
          {chartData && chartData.datasets.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Visual Comparison
              </Typography>
              <Box sx={{ height: 400 }}>
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "top", labels: { color: "#e2e8f0" } },
                      title: { display: false },
                    },
                    scales: {
                      x: { ticks: { color: "#a0aec0" }, grid: { color: "#2d3748" } },
                      y: { ticks: { color: "#a0aec0" }, grid: { color: "#2d3748" } },
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
