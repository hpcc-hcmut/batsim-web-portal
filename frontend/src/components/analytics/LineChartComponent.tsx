/**
 * LineChartComponent - Reusable line chart for time series data
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

// Register Chart.js components
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

interface LineChartComponentProps {
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    fill?: boolean;
  }[];
  height?: number;
}

const LineChartComponent: React.FC<LineChartComponentProps> = ({
  title,
  labels,
  datasets,
  height = 300,
}) => {
  const chartData = {
    labels,
    datasets: datasets.map((ds, idx) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.borderColor || getDefaultColor(idx),
      backgroundColor: ds.backgroundColor || getDefaultColor(idx, 0.2),
      fill: ds.fill !== undefined ? ds.fill : true,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
    })),
  };

  const options: ChartOptions<"line"> = {
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
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
        {title}
      </Typography>
      <Box sx={{ height }}>
        <Line data={chartData} options={options} />
      </Box>
    </Paper>
  );
};

function getDefaultColor(index: number, alpha: number = 1): string {
  const colors = [
    `rgba(74, 158, 255, ${alpha})`,
    `rgba(76, 175, 80, ${alpha})`,
    `rgba(255, 152, 0, ${alpha})`,
    `rgba(156, 39, 176, ${alpha})`,
    `rgba(244, 67, 54, ${alpha})`,
  ];
  return colors[index % colors.length];
}

export default LineChartComponent;
