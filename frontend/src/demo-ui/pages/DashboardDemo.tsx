import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Button,
  Stack,
  Tabs,
  Tab,
  Divider,
} from "@mui/material";
import {
  Storage,
  Computer,
  Settings,
  Code,
  Science,
  Analytics,
} from "@mui/icons-material";
import {
  mockDashboardStats,
  mockExperiments,
  mockSystemStats,
  MockExperiment,
} from "../mockData";

const DashboardDemo: React.FC = () => {
  const [expTab, setExpTab] = useState(0);
  const [experiments, setExperiments] = useState<MockExperiment[]>(mockExperiments);

  // Simulate running experiments progress
  useEffect(() => {
    const interval = setInterval(() => {
      setExperiments((prev) =>
        prev.map((exp) => {
          if (exp.status === "running" && exp.progress_percentage < 100) {
            const newProgress = Math.min(exp.progress_percentage + Math.random() * 2, 100);
            const newCompleted = Math.floor((newProgress / 100) * exp.total_jobs);
            return {
              ...exp,
              progress_percentage: newProgress,
              completed_jobs: newCompleted,
              status: newProgress >= 100 ? "completed" : "running",
            };
          }
          return exp;
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const tabLabels = ["Running", "Completed", "Failed"];
  const filteredExperiments = experiments.filter(
    (exp) =>
      (expTab === 0 && exp.status === "running") ||
      (expTab === 1 && exp.status === "completed") ||
      (expTab === 2 && (exp.status === "failed" || exp.status === "cancelled"))
  );

  const statsCards = [
    {
      icon: <Storage sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
      label: "Workloads",
      value: mockDashboardStats.workloads,
    },
    {
      icon: <Computer sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
      label: "Platforms",
      value: mockDashboardStats.platforms,
    },
    {
      icon: <Settings sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
      label: "Scenarios",
      value: mockDashboardStats.scenarios,
    },
    {
      icon: <Code sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
      label: "Strategies",
      value: mockDashboardStats.strategies,
    },
    {
      icon: <Science sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
      label: "Experiments",
      value: mockDashboardStats.experiments,
    },
    {
      icon: <Analytics sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
      label: "Results",
      value: mockDashboardStats.results,
    },
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: "linear-gradient(90deg, #2d3748 0%, #0c2259 100%)",
          borderRadius: 16,
          p: { xs: 3, md: 6 },
          mb: 5,
          color: "#e2e8f0",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 180,
          boxShadow: "0 4px 32px 0 rgba(74,158,255,0.15)",
        }}
      >
        <Box sx={{ flex: 2, minWidth: 0 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
            Welcome to BatSim Web Portal
          </Typography>
          <Typography
            variant="body1"
            sx={{ opacity: 0.9, mb: 3, fontSize: 16, maxWidth: 600 }}
          >
            Manage, run, and analyze your BatSim experiments with ease. Upload
            workloads, platforms, and strategies, create scenarios, launch
            experiments, and view results—all in one place.
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Button
              variant="contained"
              color="primary"
              href="/demo/experiments"
              size="large"
              sx={{ fontWeight: 900, borderRadius: 8, py: 1.5 }}
            >
              Start New Experiment
            </Button>
            <Button
              variant="outlined"
              color="primary"
              href="/demo/workloads"
              size="large"
              sx={{ fontWeight: 700, borderRadius: 8, borderWidth: 2 }}
            >
              Upload New Workload
            </Button>
            <Button
              variant="outlined"
              color="primary"
              href="/demo/platforms"
              size="large"
              sx={{ fontWeight: 700, borderRadius: 8, borderWidth: 2 }}
            >
              Upload New Platform
            </Button>
            <Button
              variant="outlined"
              color="primary"
              href="/demo/strategies"
              size="large"
              sx={{ fontWeight: 700, borderRadius: 8, borderWidth: 2 }}
            >
              Upload New Strategy
            </Button>
            <Button
              variant="outlined"
              color="primary"
              href="/demo/scenarios"
              size="large"
              sx={{ fontWeight: 700, borderRadius: 8, borderWidth: 2 }}
            >
              Create Scenario
            </Button>
          </Stack>
        </Box>
        <Box
          sx={{
            flex: 1,
            display: { xs: "none", md: "flex" },
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <img
            src="/src/assets/batweb-logo.png"
            alt="BatSim"
            style={{
              height: 140,
              maxWidth: 260,
            }}
          />
        </Box>
      </Box>

      {/* Portal Stats Section */}
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2, mt: 2 }}>
        Portal Stats
      </Typography>
      <Grid container spacing={3} sx={{ mb: 5, justifyContent: "flex-start" }}>
        {statsCards.map((stat) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={stat.label}>
            <Card
              sx={{
                p: 3,
                textAlign: "center",
                borderRadius: 2,
                background: "rgba(26,32,44,0.98)",
                boxShadow: "0 2px 12px 0 rgba(74,158,255,0.08)",
              }}
            >
              {stat.icon}
              <Typography
                variant="h4"
                fontWeight={900}
                sx={{ color: "#fff", mb: 0.5 }}
              >
                {stat.value}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 700, letterSpacing: 0.5 }}
              >
                {stat.label}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* System Resources */}
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2, mt: 2 }}>
        System Resources
      </Typography>
      <Grid container spacing={3} sx={{ mb: 5 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              CPU Usage
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ color: "#4a9eff" }}>
              {mockSystemStats.cpu[mockSystemStats.cpu.length - 1]}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={mockSystemStats.cpu[mockSystemStats.cpu.length - 1]}
              sx={{ mt: 1, height: 8, borderRadius: 4 }}
            />
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Memory Usage
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ color: "#4caf50" }}>
              {mockSystemStats.memory[mockSystemStats.memory.length - 1]}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={mockSystemStats.memory[mockSystemStats.memory.length - 1]}
              color="success"
              sx={{ mt: 1, height: 8, borderRadius: 4 }}
            />
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Disk Usage
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ color: "#ff9800" }}>
              {mockSystemStats.disk[mockSystemStats.disk.length - 1]}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={mockSystemStats.disk[mockSystemStats.disk.length - 1]}
              color="warning"
              sx={{ mt: 1, height: 8, borderRadius: 4 }}
            />
          </Card>
        </Grid>
      </Grid>

      {/* Experiments Overview Section */}
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2, mt: 2 }}>
        Experiments Overview
      </Typography>
      <Card
        sx={{
          p: 0,
          borderRadius: 2,
          background: "rgba(24,34,53,0.98)",
          boxShadow: "0 2px 12px 0 rgba(0,224,211,0.04)",
          mb: 4,
        }}
      >
        <Tabs
          value={expTab}
          onChange={(_, v) => setExpTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 3, pt: 2 }}
        >
          {tabLabels.map((label) => (
            <Tab
              key={label}
              label={label}
              sx={{ fontWeight: 700, color: "#e2e8f0" }}
            />
          ))}
        </Tabs>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
        <Box sx={{ p: 3 }}>
          {filteredExperiments.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ my: 4 }}>
              No {tabLabels[expTab].toLowerCase()} experiments found.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {filteredExperiments.map((exp) => (
                <Grid item xs={12} md={6} lg={4} key={exp.id}>
                  <Card
                    sx={{
                      borderRadius: 2,
                      background: "rgba(26,32,44,0.98)",
                      height: "100%",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
                      },
                    }}
                  >
                    <CardContent>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        mb={2}
                      >
                        <Science sx={{ fontSize: 32, color: "#4a9eff" }} />
                        <Box>
                          <Typography
                            variant="h6"
                            fontWeight={900}
                            sx={{ color: "#fff" }}
                          >
                            {exp.name}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={
                                exp.status.charAt(0).toUpperCase() +
                                exp.status.slice(1)
                              }
                              size="small"
                              color={
                                exp.status === "running"
                                  ? "primary"
                                  : exp.status === "completed"
                                  ? "success"
                                  : exp.status === "paused"
                                  ? "warning"
                                  : "error"
                              }
                              sx={{ fontWeight: 700 }}
                            />
                            {exp.status === "running" && (
                              <Typography variant="body2" color="text.secondary">
                                {exp.progress_percentage.toFixed(0)}%
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mb: 2 }}
                        color="text.secondary"
                      >
                        {exp.description}
                      </Typography>
                      <Stack direction="row" spacing={1} mb={1}>
                        <Chip
                          label={exp.scenario_name}
                          size="small"
                          color="secondary"
                        />
                        <Chip
                          label={exp.strategy_name}
                          size="small"
                          color="secondary"
                        />
                      </Stack>
                      {exp.status === "running" && (
                        <LinearProgress
                          variant="determinate"
                          value={exp.progress_percentage}
                          sx={{
                            mt: 1,
                            height: 8,
                            borderRadius: 4,
                            background: "#23304a",
                          }}
                        />
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Card>
    </Box>
  );
};

export default DashboardDemo;
