/**
 * StrategyComparisonChart - Compare performance metrics across strategies
 */

import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Box, Paper, Typography, Stack, Chip } from "@mui/material";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StrategyData {
  name: string;
  avgMakespan?: number;
  avgWaitingTime?: number;
  avgTurnaroundTime?: number;
  avgResourceUtilization?: number;
  count: number;
}

interface StrategyComparisonChartProps {
  strategies: StrategyData[];
  height?: number;
}

const StrategyComparisonChart: React.FC<StrategyComparisonChartProps> = ({
  strategies,
  height = 350,
}) => {
  if (strategies.length === 0) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2, background: "rgba(26,32,44,0.98)", textAlign: "center" }}>
        <Typography variant="body1" color="text.secondary">
          No strategy comparison data available
        </Typography>
      </Paper>
    );
  }

  const labels = strategies.map((s) => s.name);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Avg Makespan (s)",
        data: strategies.map((s) => s.avgMakespan || 0),
        backgroundColor: "rgba(74, 158, 255, 0.7)",
        borderColor: "rgba(74, 158, 255, 1)",
        borderWidth: 1,
      },
      {
        label: "Avg Waiting Time (s)",
        data: strategies.map((s) => s.avgWaitingTime || 0),
        backgroundColor: "rgba(255, 152, 0, 0.7)",
        borderColor: "rgba(255, 152, 0, 1)",
        borderWidth: 1,
      },
      {
        label: "Avg Turnaround Time (s)",
        data: strategies.map((s) => s.avgTurnaroundTime || 0),
        backgroundColor: "rgba(76, 175, 80, 0.7)",
        borderColor: "rgba(76, 175, 80, 1)",
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "#e2e8f0",
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(26, 32, 44, 0.95)",
        titleColor: "#fff",
        bodyColor: "#e2e8f0",
        borderColor: "#4a9eff",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: "#a0aec0" },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
      },
      y: {
        ticks: { color: "#a0aec0" },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
        beginAtZero: true,
      },
    },
  };

  return (
    <Paper sx={{ p: 2, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
          Strategy Performance Comparison
        </Typography>
        <Chip
          label={`${strategies.length} strategies`}
          size="small"
          sx={{ bgcolor: "rgba(74, 158, 255, 0.2)", color: "#4a9eff" }}
        />
      </Stack>
      <Box sx={{ height }}>
        <Bar data={chartData} options={options} />
      </Box>
    </Paper>
  );
};

export default StrategyComparisonChart;
