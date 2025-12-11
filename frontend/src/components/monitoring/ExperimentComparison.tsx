/**
 * ExperimentComparison - Compare 2-3 experiments side by side.
 *
 * Shows status, progress, and key metrics for comparison.
 */

import React from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  LinearProgress,
  Divider,
  Grid,
  Avatar,
} from "@mui/material";
import { Science, CompareArrows } from "@mui/icons-material";

interface ExperimentComparisonData {
  id: number;
  name: string;
  status: string;
  progressPercentage: number;
  completedJobs: number;
  totalJobs: number;
  elapsedSeconds?: number;
  scenarioName?: string;
  strategyName?: string;
}

interface ExperimentComparisonProps {
  experiments: ExperimentComparisonData[];
}

const ExperimentComparison: React.FC<ExperimentComparisonProps> = ({
  experiments,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "#4a9eff";
      case "completed":
        return "#4caf50";
      case "failed":
        return "#f44336";
      case "cancelled":
        return "#ff9800";
      default:
        return "#9e9e9e";
    }
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (experiments.length === 0) {
    return (
      <Paper
        sx={{
          p: 4,
          borderRadius: 2,
          background: "rgba(26,32,44,0.98)",
          textAlign: "center",
        }}
      >
        <CompareArrows sx={{ fontSize: 48, color: "#4a9eff", mb: 2 }} />
        <Typography variant="h6" sx={{ color: "#fff", mb: 1 }}>
          No Experiments Selected
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select 2-3 experiments to compare their progress and metrics.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 2,
        background: "rgba(26,32,44,0.98)",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <CompareArrows sx={{ fontSize: 28, color: "#4a9eff" }} />
        <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
          Experiment Comparison
        </Typography>
        <Chip
          label={`${experiments.length} experiments`}
          size="small"
          sx={{ bgcolor: "rgba(74,158,255,0.2)", color: "#4a9eff" }}
        />
      </Stack>

      <Grid container spacing={3}>
        {experiments.map((exp) => (
          <Grid size={{ xs: 12, md: experiments.length === 2 ? 6 : 4 }} key={exp.id}>
            <Paper
              sx={{
                p: 2,
                borderRadius: 2,
                background: "rgba(13,17,23,0.9)",
                border: `2px solid ${getStatusColor(exp.status)}44`,
                height: "100%",
              }}
            >
              {/* Header */}
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: `${getStatusColor(exp.status)}22`,
                    color: getStatusColor(exp.status),
                  }}
                >
                  <Science />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    sx={{ color: "#fff", overflow: "hidden", textOverflow: "ellipsis" }}
                    noWrap
                  >
                    {exp.name}
                  </Typography>
                  <Chip
                    label={exp.status.toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: `${getStatusColor(exp.status)}22`,
                      color: getStatusColor(exp.status),
                      fontWeight: 700,
                      height: 20,
                      fontSize: "0.65rem",
                    }}
                  />
                </Box>
              </Stack>

              {/* Progress */}
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Progress
                  </Typography>
                  <Typography variant="caption" fontWeight={700} sx={{ color: "#fff" }}>
                    {exp.progressPercentage.toFixed(1)}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={exp.progressPercentage}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: "rgba(255,255,255,0.1)",
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 4,
                      bgcolor: getStatusColor(exp.status),
                    },
                  }}
                />
              </Box>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", my: 2 }} />

              {/* Metrics */}
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Jobs
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ color: "#fff" }}>
                    {exp.completedJobs} / {exp.totalJobs}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Elapsed
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ color: "#fff" }}>
                    {formatTime(exp.elapsedSeconds)}
                  </Typography>
                </Stack>

                {exp.scenarioName && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Scenario
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ color: "#4a9eff", maxWidth: 120 }}
                      noWrap
                    >
                      {exp.scenarioName}
                    </Typography>
                  </Stack>
                )}

                {exp.strategyName && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Strategy
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ color: "#9c27b0", maxWidth: 120 }}
                      noWrap
                    >
                      {exp.strategyName}
                    </Typography>
                  </Stack>
                )}

                {/* Rate calculation */}
                {exp.elapsedSeconds && exp.elapsedSeconds > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Rate
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: "#4caf50" }}>
                      {(exp.completedJobs / exp.elapsedSeconds).toFixed(2)} jobs/s
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

export default ExperimentComparison;
