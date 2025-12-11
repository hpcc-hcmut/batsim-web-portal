import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Button,
  Stack,
  Chip,
  LinearProgress,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  PlayArrow,
  Pause,
  Stop,
  Refresh,
  Speed,
  Memory,
  Storage,
  Timer,
  CheckCircle,
  Error,
  Schedule,
  Computer,
} from "@mui/icons-material";

// Types for simulation
interface SimulationJob {
  id: number;
  name: string;
  status: "waiting" | "running" | "completed" | "failed";
  resource_id: number;
  submit_time: number;
  start_time?: number;
  end_time?: number;
  walltime: number;
  progress: number;
}

interface SimulationResource {
  id: number;
  name: string;
  status: "idle" | "busy" | "reserved" | "unavailable";
  current_job?: number;
  utilization: number;
}

interface SimulationState {
  id: number;
  name: string;
  status: "idle" | "running" | "paused" | "completed" | "failed";
  current_time: number;
  total_time: number;
  jobs: SimulationJob[];
  resources: SimulationResource[];
  completed_jobs: number;
  total_jobs: number;
  makespan: number;
  avg_waiting_time: number;
  resource_utilization: number;
}

// Mock simulation data generator
const generateMockResources = (count: number): SimulationResource[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Node-${i.toString().padStart(2, "0")}`,
    status: "idle" as const,
    utilization: 0,
  }));
};

const generateMockJobs = (count: number): SimulationJob[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Job-${i.toString().padStart(3, "0")}`,
    status: "waiting" as const,
    resource_id: -1,
    submit_time: Math.floor(Math.random() * 100),
    walltime: Math.floor(Math.random() * 50) + 10,
    progress: 0,
  }));
};

const initialSimulation: SimulationState = {
  id: 1,
  name: "HPC Batch Simulation",
  status: "idle",
  current_time: 0,
  total_time: 500,
  jobs: generateMockJobs(24),
  resources: generateMockResources(16),
  completed_jobs: 0,
  total_jobs: 24,
  makespan: 0,
  avg_waiting_time: 0,
  resource_utilization: 0,
};

const SimulationPage: React.FC = () => {
  const [simulation, setSimulation] = useState<SimulationState>(initialSimulation);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Simulation tick logic
  const simulationTick = () => {
    setSimulation((prev) => {
      if (prev.status !== "running") return prev;

      const newTime = prev.current_time + 1;
      let newJobs = [...prev.jobs];
      let newResources = [...prev.resources];

      // Process jobs
      newJobs = newJobs.map((job) => {
        // Start waiting jobs if resources available
        if (job.status === "waiting" && job.submit_time <= newTime) {
          const availableResource = newResources.find(
            (r) => r.status === "idle"
          );
          if (availableResource) {
            availableResource.status = "busy";
            availableResource.current_job = job.id;
            availableResource.utilization = 100;
            return {
              ...job,
              status: "running" as const,
              resource_id: availableResource.id,
              start_time: newTime,
            };
          }
        }

        // Update running jobs
        if (job.status === "running") {
          const elapsed = newTime - (job.start_time || 0);
          const progress = Math.min((elapsed / job.walltime) * 100, 100);

          if (progress >= 100) {
            // Job completed
            const resource = newResources.find(
              (r) => r.id === job.resource_id
            );
            if (resource) {
              resource.status = "idle";
              resource.current_job = undefined;
              resource.utilization = 0;
            }
            return {
              ...job,
              status: "completed" as const,
              end_time: newTime,
              progress: 100,
            };
          }

          return { ...job, progress };
        }

        return job;
      });

      // Calculate metrics
      const completedJobs = newJobs.filter((j) => j.status === "completed");
      const runningJobs = newJobs.filter((j) => j.status === "running");
      const busyResources = newResources.filter((r) => r.status === "busy");

      const avgWaitingTime =
        completedJobs.length > 0
          ? completedJobs.reduce(
              (sum, j) => sum + ((j.start_time || 0) - j.submit_time),
              0
            ) / completedJobs.length
          : 0;

      const resourceUtilization =
        (busyResources.length / newResources.length) * 100;

      const makespan =
        completedJobs.length > 0
          ? Math.max(...completedJobs.map((j) => j.end_time || 0))
          : 0;

      // Check if simulation complete
      const allCompleted = newJobs.every(
        (j) => j.status === "completed" || j.status === "failed"
      );

      return {
        ...prev,
        current_time: newTime,
        jobs: newJobs,
        resources: newResources,
        completed_jobs: completedJobs.length,
        avg_waiting_time: avgWaitingTime,
        resource_utilization: resourceUtilization,
        makespan,
        status: allCompleted ? "completed" : prev.status,
      };
    });
  };

  // Control functions
  const startSimulation = () => {
    setSimulation((prev) => ({ ...prev, status: "running" }));
  };

  const pauseSimulation = () => {
    setSimulation((prev) => ({ ...prev, status: "paused" }));
  };

  const stopSimulation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSimulation(initialSimulation);
  };

  const resetSimulation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSimulation({
      ...initialSimulation,
      jobs: generateMockJobs(24),
      resources: generateMockResources(16),
    });
  };

  // Simulation loop
  useEffect(() => {
    if (simulation.status === "running") {
      intervalRef.current = setInterval(simulationTick, 1000 / speed);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [simulation.status, speed]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "idle":
        return "#a0aec0";
      case "running":
        return "#4a9eff";
      case "paused":
        return "#ffc107";
      case "completed":
        return "#4caf50";
      case "failed":
        return "#f44336";
      default:
        return "#a0aec0";
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "#a0aec0";
      case "running":
        return "#4a9eff";
      case "completed":
        return "#4caf50";
      case "failed":
        return "#f44336";
      default:
        return "#a0aec0";
    }
  };

  const getResourceStatusColor = (status: string) => {
    switch (status) {
      case "idle":
        return "#2d3748";
      case "busy":
        return "#4a9eff";
      case "reserved":
        return "#ffc107";
      case "unavailable":
        return "#f44336";
      default:
        return "#2d3748";
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={900} gutterBottom>
            Simulation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time visualization of BatSim job scheduling simulation
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={simulation.status.toUpperCase()}
            sx={{
              bgcolor: getStatusColor(simulation.status),
              color: "#fff",
              fontWeight: 700,
            }}
          />
        </Stack>
      </Box>

      {/* Controls */}
      <Card sx={{ mb: 3, background: "rgba(26,32,44,0.98)" }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1}>
              {simulation.status === "running" ? (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<Pause />}
                  onClick={pauseSimulation}
                  sx={{ fontWeight: 700 }}
                >
                  Pause
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PlayArrow />}
                  onClick={startSimulation}
                  disabled={simulation.status === "completed"}
                  sx={{ fontWeight: 700 }}
                >
                  {simulation.status === "paused" ? "Resume" : "Start"}
                </Button>
              )}
              <Button
                variant="outlined"
                color="error"
                startIcon={<Stop />}
                onClick={stopSimulation}
                sx={{ fontWeight: 700 }}
              >
                Stop
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<Refresh />}
                onClick={resetSimulation}
                sx={{ fontWeight: 700 }}
              >
                Reset
              </Button>
            </Stack>

            <Stack direction="row" spacing={2} alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <Speed sx={{ color: "#4a9eff" }} />
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>Speed</InputLabel>
                  <Select
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    label="Speed"
                  >
                    <MenuItem value={0.5}>0.5x</MenuItem>
                    <MenuItem value={1}>1x</MenuItem>
                    <MenuItem value={2}>2x</MenuItem>
                    <MenuItem value={5}>5x</MenuItem>
                    <MenuItem value={10}>10x</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Time: {simulation.current_time}s / {simulation.total_time}s
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card sx={{ mb: 3, background: "rgba(26,32,44,0.98)" }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Simulation Progress
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(simulation.current_time / simulation.total_time) * 100}
            sx={{ height: 8, borderRadius: 4, mb: 2 }}
          />
          <Stack direction="row" spacing={2} justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {Math.round((simulation.current_time / simulation.total_time) * 100)}% Complete
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Jobs: {simulation.completed_jobs} / {simulation.total_jobs}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ background: "rgba(26,32,44,0.98)", height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Timer sx={{ color: "#4a9eff" }} />
                <Typography variant="body2" color="text.secondary">
                  Makespan
                </Typography>
              </Stack>
              <Typography variant="h5" fontWeight={700}>
                {simulation.makespan.toFixed(1)}s
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ background: "rgba(26,32,44,0.98)", height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Schedule sx={{ color: "#ffc107" }} />
                <Typography variant="body2" color="text.secondary">
                  Avg Wait Time
                </Typography>
              </Stack>
              <Typography variant="h5" fontWeight={700}>
                {simulation.avg_waiting_time.toFixed(1)}s
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ background: "rgba(26,32,44,0.98)", height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Memory sx={{ color: "#4caf50" }} />
                <Typography variant="body2" color="text.secondary">
                  Resource Util.
                </Typography>
              </Stack>
              <Typography variant="h5" fontWeight={700}>
                {simulation.resource_utilization.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ background: "rgba(26,32,44,0.98)", height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <CheckCircle sx={{ color: "#4caf50" }} />
                <Typography variant="body2" color="text.secondary">
                  Completed
                </Typography>
              </Stack>
              <Typography variant="h5" fontWeight={700}>
                {simulation.completed_jobs}/{simulation.total_jobs}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Resource Grid & Job Queue */}
      <Grid container spacing={3}>
        {/* Resource Visualization */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ background: "rgba(26,32,44,0.98)", height: "100%" }}>
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                mb={2}
              >
                <Computer sx={{ color: "#4a9eff" }} />
                <Typography variant="h6" fontWeight={700}>
                  Resources ({simulation.resources.length})
                </Typography>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
                  gap: 1,
                }}
              >
                {simulation.resources.map((resource) => (
                  <Tooltip
                    key={resource.id}
                    title={`${resource.name} - ${resource.status}${
                      resource.current_job !== undefined
                        ? ` (Job ${resource.current_job})`
                        : ""
                    }`}
                  >
                    <Box
                      sx={{
                        width: "100%",
                        paddingTop: "100%",
                        position: "relative",
                        borderRadius: 1,
                        bgcolor: getResourceStatusColor(resource.status),
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                        "&:hover": {
                          transform: "scale(1.1)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                        },
                      }}
                    >
                      <Box
                        sx={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#fff",
                        }}
                      >
                        {resource.id}
                      </Box>
                    </Box>
                  </Tooltip>
                ))}
              </Box>
              <Stack
                direction="row"
                spacing={2}
                mt={2}
                justifyContent="center"
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: 0.5,
                      bgcolor: "#2d3748",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Idle
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: 0.5,
                      bgcolor: "#4a9eff",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Busy
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Job Queue */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ background: "rgba(26,32,44,0.98)", height: "100%" }}>
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                mb={2}
              >
                <Storage sx={{ color: "#4a9eff" }} />
                <Typography variant="h6" fontWeight={700}>
                  Jobs ({simulation.jobs.length})
                </Typography>
              </Stack>
              <Box
                sx={{
                  maxHeight: 300,
                  overflow: "auto",
                  pr: 1,
                }}
              >
                <Stack spacing={1}>
                  {simulation.jobs
                    .filter((j) => j.status !== "completed")
                    .slice(0, 10)
                    .map((job) => (
                      <Paper
                        key={job.id}
                        sx={{
                          p: 1.5,
                          bgcolor: "rgba(45,55,72,0.5)",
                          borderLeft: `3px solid ${getJobStatusColor(job.status)}`,
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {job.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Walltime: {job.walltime}s
                            </Typography>
                          </Box>
                          <Stack alignItems="flex-end">
                            <Chip
                              label={job.status}
                              size="small"
                              sx={{
                                bgcolor: getJobStatusColor(job.status),
                                color: "#fff",
                                fontSize: 10,
                                height: 20,
                              }}
                            />
                            {job.status === "running" && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {job.progress.toFixed(0)}%
                              </Typography>
                            )}
                          </Stack>
                        </Stack>
                        {job.status === "running" && (
                          <LinearProgress
                            variant="determinate"
                            value={job.progress}
                            sx={{ mt: 1, height: 4, borderRadius: 2 }}
                          />
                        )}
                      </Paper>
                    ))}
                </Stack>
              </Box>

              {/* Summary */}
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" spacing={2} justifyContent="center">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "#a0aec0",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Waiting:{" "}
                    {simulation.jobs.filter((j) => j.status === "waiting").length}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "#4a9eff",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Running:{" "}
                    {simulation.jobs.filter((j) => j.status === "running").length}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "#4caf50",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Completed:{" "}
                    {simulation.jobs.filter((j) => j.status === "completed").length}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Gantt-style Timeline (simplified) */}
      <Card sx={{ mt: 3, background: "rgba(26,32,44,0.98)" }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Execution Timeline
          </Typography>
          <Box
            sx={{
              overflowX: "auto",
              pb: 2,
            }}
          >
            <Box
              sx={{
                minWidth: 600,
                height: 200,
                position: "relative",
                bgcolor: "rgba(45,55,72,0.3)",
                borderRadius: 1,
                p: 2,
              }}
            >
              {/* Resource lanes */}
              {simulation.resources.slice(0, 8).map((resource, index) => (
                <Box
                  key={resource.id}
                  sx={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: index * 22 + 8,
                    height: 18,
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      position: "absolute",
                      left: 4,
                      top: 0,
                      color: "#a0aec0",
                      fontSize: 10,
                    }}
                  >
                    {resource.name}
                  </Typography>
                  {/* Job bars */}
                  {simulation.jobs
                    .filter(
                      (j) =>
                        j.resource_id === resource.id &&
                        (j.status === "running" || j.status === "completed")
                    )
                    .map((job) => {
                      const startX =
                        ((job.start_time || 0) / simulation.total_time) * 100;
                      const endX =
                        ((job.end_time ||
                          job.start_time! +
                            (job.progress / 100) * job.walltime) /
                          simulation.total_time) *
                        100;
                      const width = endX - startX;
                      return (
                        <Tooltip
                          key={job.id}
                          title={`${job.name} (${job.start_time}s - ${
                            job.end_time || "..."
                          }s)`}
                        >
                          <Box
                            sx={{
                              position: "absolute",
                              left: `calc(60px + ${startX}%)`,
                              width: `${width}%`,
                              height: 14,
                              top: 2,
                              bgcolor:
                                job.status === "completed"
                                  ? "#4caf50"
                                  : "#4a9eff",
                              borderRadius: 0.5,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                </Box>
              ))}
              {/* Time marker */}
              <Box
                sx={{
                  position: "absolute",
                  left: `calc(60px + ${
                    (simulation.current_time / simulation.total_time) * 100
                  }%)`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  bgcolor: "#f44336",
                  zIndex: 10,
                }}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SimulationPage;
