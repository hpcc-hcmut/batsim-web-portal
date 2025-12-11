/**
 * RealtimeProgressChart - Displays real-time experiment progress with animated updates.
 *
 * Shows progress percentage, completed/total jobs with smooth transitions.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Stack,
  Chip,
  Paper,
} from "@mui/material";
import { TrendingUp, Schedule, CheckCircle } from "@mui/icons-material";

interface RealtimeProgressChartProps {
  progressPercentage: number;
  completedJobs: number;
  totalJobs: number;
  status: string;
  elapsedSeconds?: number;
}

const RealtimeProgressChart: React.FC<RealtimeProgressChartProps> = ({
  progressPercentage,
  completedJobs,
  totalJobs,
  status,
  elapsedSeconds,
}) => {
  const [displayProgress, setDisplayProgress] = useState(progressPercentage);
  const prevProgressRef = useRef(progressPercentage);

  // Animate progress changes smoothly
  useEffect(() => {
    const targetProgress = progressPercentage;
    const currentProgress = prevProgressRef.current;

    if (targetProgress !== currentProgress) {
      const diff = targetProgress - currentProgress;
      const steps = 20;
      const stepSize = diff / steps;
      let step = 0;

      const interval = setInterval(() => {
        step++;
        if (step >= steps) {
          setDisplayProgress(targetProgress);
          prevProgressRef.current = targetProgress;
          clearInterval(interval);
        } else {
          setDisplayProgress(currentProgress + stepSize * step);
        }
      }, 25);

      return () => clearInterval(interval);
    }
  }, [progressPercentage]);

  const formatElapsedTime = (seconds?: number) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = () => {
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

  const jobsRemaining = totalJobs - completedJobs;
  const estimatedTimeRemaining =
    elapsedSeconds && completedJobs > 0
      ? Math.round((elapsedSeconds / completedJobs) * jobsRemaining)
      : null;

  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 2,
        background: "rgba(26,32,44,0.98)",
        border: `1px solid ${getStatusColor()}33`,
      }}
    >
      <Stack spacing={2}>
        {/* Progress Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
            Progress
          </Typography>
          <Chip
            label={status.toUpperCase()}
            size="small"
            sx={{
              bgcolor: `${getStatusColor()}22`,
              color: getStatusColor(),
              fontWeight: 700,
            }}
          />
        </Stack>

        {/* Main Progress Bar */}
        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {displayProgress.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {completedJobs} / {totalJobs} jobs
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={displayProgress}
            sx={{
              height: 12,
              borderRadius: 6,
              bgcolor: "rgba(255,255,255,0.1)",
              "& .MuiLinearProgress-bar": {
                borderRadius: 6,
                bgcolor: getStatusColor(),
                transition: "transform 0.3s ease-out",
              },
            }}
          />
        </Box>

        {/* Stats Row */}
        <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CheckCircle sx={{ fontSize: 18, color: "#4caf50" }} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Completed
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }}>
                {completedJobs}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Schedule sx={{ fontSize: 18, color: "#ff9800" }} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Remaining
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }}>
                {jobsRemaining}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <TrendingUp sx={{ fontSize: 18, color: "#4a9eff" }} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Elapsed
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }}>
                {formatElapsedTime(elapsedSeconds)}
              </Typography>
            </Box>
          </Stack>

          {estimatedTimeRemaining !== null && status === "running" && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Schedule sx={{ fontSize: 18, color: "#9c27b0" }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  ETA
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }}>
                  {formatElapsedTime(estimatedTimeRemaining)}
                </Typography>
              </Box>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};

export default RealtimeProgressChart;
