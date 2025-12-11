/**
 * JobDistributionChart - Doughnut chart for job success/failure distribution
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
import { Box, Paper, Typography, Stack } from "@mui/material";

ChartJS.register(ArcElement, Tooltip, Legend);

interface JobDistributionChartProps {
  completedJobs: number;
  failedJobs: number;
  height?: number;
}

const JobDistributionChart: React.FC<JobDistributionChartProps> = ({
  completedJobs,
  failedJobs,
  height = 250,
}) => {
  const total = completedJobs + failedJobs;

  if (total === 0) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2, background: "rgba(26,32,44,0.98)", textAlign: "center" }}>
        <Typography variant="body1" color="text.secondary">
          No job data available
        </Typography>
      </Paper>
    );
  }

  const chartData = {
    labels: ["Completed", "Failed"],
    datasets: [
      {
        data: [completedJobs, failedJobs],
        backgroundColor: [
          "rgba(76, 175, 80, 0.8)",
          "rgba(244, 67, 54, 0.8)",
        ],
        borderColor: "rgba(26, 32, 44, 1)",
        borderWidth: 3,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "#e2e8f0",
          padding: 16,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "rgba(26, 32, 44, 0.95)",
        titleColor: "#fff",
        bodyColor: "#e2e8f0",
        borderColor: "#4a9eff",
        borderWidth: 1,
        callbacks: {
          label: (ctx) => {
            const pct = ((ctx.raw as number) / total * 100).toFixed(1);
            return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <Paper sx={{ p: 2, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
        Job Distribution
      </Typography>
      <Box sx={{ height, position: "relative" }}>
        <Doughnut data={chartData} options={options} />
        {/* Center text */}
        <Stack
          sx={{
            position: "absolute",
            top: "45%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
          }}
        >
          <Typography variant="h4" fontWeight={900} sx={{ color: "#fff" }}>
            {total}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Total Jobs
          </Typography>
        </Stack>
      </Box>
    </Paper>
  );
};

export default JobDistributionChart;
