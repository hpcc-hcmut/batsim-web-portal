/**
 * ResultsTrendChart - Line chart showing results over time
 */

import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from "chart.js";
import { Box, Paper, Typography } from "@mui/material";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ResultsByDate {
  date: string;
  count: number;
}

interface ResultsTrendChartProps {
  data: ResultsByDate[];
  height?: number;
}

const ResultsTrendChart: React.FC<ResultsTrendChartProps> = ({
  data,
  height = 300,
}) => {
  if (data.length === 0) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2, background: "rgba(26,32,44,0.98)", textAlign: "center" }}>
        <Typography variant="body1" color="text.secondary">
          No trend data available
        </Typography>
      </Paper>
    );
  }

  // Sort by date
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const chartData = {
    labels: sortedData.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }),
    datasets: [
      {
        label: "Results",
        data: sortedData.map((d) => d.count),
        borderColor: "rgba(74, 158, 255, 1)",
        backgroundColor: "rgba(74, 158, 255, 0.2)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "rgba(74, 158, 255, 1)",
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
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
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
        Results Over Time
      </Typography>
      <Box sx={{ height }}>
        <Line data={chartData} options={options} />
      </Box>
    </Paper>
  );
};

export default ResultsTrendChart;
