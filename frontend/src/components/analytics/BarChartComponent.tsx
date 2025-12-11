/**
 * BarChartComponent - Reusable bar chart using Chart.js
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
import { Box, Paper, Typography } from "@mui/material";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface BarChartComponentProps {
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }[];
  height?: number;
  horizontal?: boolean;
}

const BarChartComponent: React.FC<BarChartComponentProps> = ({
  title,
  labels,
  datasets,
  height = 300,
  horizontal = false,
}) => {
  const chartData = {
    labels,
    datasets: datasets.map((ds, idx) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.backgroundColor || getDefaultColor(idx, 0.7),
      borderColor: ds.borderColor || getDefaultColor(idx, 1),
      borderWidth: 1,
    })),
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: horizontal ? "y" : "x",
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
      },
    },
  };

  return (
    <Paper sx={{ p: 2, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
        {title}
      </Typography>
      <Box sx={{ height }}>
        <Bar data={chartData} options={options} />
      </Box>
    </Paper>
  );
};

function getDefaultColor(index: number, alpha: number): string {
  const colors = [
    `rgba(74, 158, 255, ${alpha})`,
    `rgba(76, 175, 80, ${alpha})`,
    `rgba(255, 152, 0, ${alpha})`,
    `rgba(156, 39, 176, ${alpha})`,
    `rgba(244, 67, 54, ${alpha})`,
    `rgba(0, 188, 212, ${alpha})`,
  ];
  return colors[index % colors.length];
}

export default BarChartComponent;
