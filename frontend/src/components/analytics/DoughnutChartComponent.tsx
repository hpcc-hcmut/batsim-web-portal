/**
 * DoughnutChartComponent - Pie/Doughnut chart for proportional data
 */

import React from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Box, Paper, Typography } from "@mui/material";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface DoughnutChartComponentProps {
  title: string;
  labels: string[];
  data: number[];
  colors?: string[];
  height?: number;
}

const DoughnutChartComponent: React.FC<DoughnutChartComponentProps> = ({
  title,
  labels,
  data,
  colors,
  height = 300,
}) => {
  const defaultColors = [
    "rgba(74, 158, 255, 0.8)",
    "rgba(76, 175, 80, 0.8)",
    "rgba(255, 152, 0, 0.8)",
    "rgba(156, 39, 176, 0.8)",
    "rgba(244, 67, 54, 0.8)",
    "rgba(0, 188, 212, 0.8)",
  ];

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors || defaultColors.slice(0, data.length),
        borderColor: "rgba(26, 32, 44, 1)",
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          color: "#e2e8f0",
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: "rgba(26, 32, 44, 0.95)",
        titleColor: "#fff",
        bodyColor: "#e2e8f0",
        borderColor: "#4a9eff",
        borderWidth: 1,
      },
    },
  };

  return (
    <Paper sx={{ p: 2, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
        {title}
      </Typography>
      <Box sx={{ height }}>
        <Doughnut data={chartData} options={options} />
      </Box>
    </Paper>
  );
};

export default DoughnutChartComponent;
