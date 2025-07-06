import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Paper,
  Button,
  Avatar,
  Stack,
} from "@mui/material";
import {
  Storage,
  Computer,
  Settings,
  Code,
  Science,
  Analytics,
  TrendingUp,
  Star,
  ContentCopy,
} from "@mui/icons-material";
import {
  workloadsAPI,
  platformsAPI,
  scenariosAPI,
  strategiesAPI,
  experimentsAPI,
  resultsAPI,
} from "../services/api";
import {
  Workload,
  Platform,
  Scenario,
  Strategy,
  Experiment,
  Result,
} from "../services/api";

interface DashboardStats {
  workloads: number;
  platforms: number;
  scenarios: number;
  strategies: number;
  experiments: number;
  results: number;
  runningExperiments: number;
  completedExperiments: number;
}

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    workloads: 0,
    platforms: 0,
    scenarios: 0,
    strategies: 0,
    experiments: 0,
    results: 0,
    runningExperiments: 0,
    completedExperiments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          workloadsRes,
          platformsRes,
          scenariosRes,
          strategiesRes,
          experimentsRes,
          resultsRes,
        ] = await Promise.all([
          workloadsAPI.getAll(),
          platformsAPI.getAll(),
          scenariosAPI.getAll(),
          strategiesAPI.getAll(),
          experimentsAPI.getAll(),
          resultsAPI.getAll(),
        ]);

        // Robustly get experiments array
        const experiments = Array.isArray(experimentsRes.data)
          ? experimentsRes.data
          : experimentsRes.data.items || [];
        const runningExperiments = experiments.filter(
          (exp: Experiment) => exp.status === "running"
        ).length;
        const completedExperiments = experiments.filter(
          (exp: Experiment) => exp.status === "completed"
        ).length;

        setStats({
          workloads: workloadsRes.data.length,
          platforms: platformsRes.data.length,
          scenarios: scenariosRes.data.length,
          strategies: strategiesRes.data.length,
          experiments: experiments.length,
          results: resultsRes.data.length,
          runningExperiments,
          completedExperiments,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ width: "100%" }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: "linear-gradient(90deg, #2d3748 0%, #4a9eff 100%)",
          borderRadius: 1,
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
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" fontWeight={900} gutterBottom sx={{ mb: 2 }}>
            Welcome to BatSim Web Portal
          </Typography>
          <Typography
            variant="body1"
            sx={{ opacity: 0.9, mb: 3, fontSize: 18, maxWidth: 600 }}
          >
            Manage, run, and analyze your BatSim experiments with ease. Upload
            workloads, platforms, and strategies, create scenarios, launch
            experiments, and view results—all in one place.
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              href="/experiments"
              sx={{ fontWeight: 700, px: 4, py: 1.5, borderRadius: 1 }}
            >
              Start New Experiment
            </Button>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              href="/workloads"
              sx={{
                fontWeight: 700,
                px: 4,
                py: 1.5,
                borderRadius: 1,
                borderWidth: 2,
              }}
            >
              Upload Workload
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
            src="/batsim-hero.png"
            alt="BatSim"
            style={{
              height: 140,
              maxWidth: 260,
              borderRadius: 1,
              boxShadow: "0 2px 16px 0 rgba(74,158,255,0.15)",
            }}
          />
        </Box>
      </Box>

      {/* Portal Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 5, justifyContent: "center" }}>
        {[
          {
            icon: <Storage sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
            label: "Workloads",
            value: stats.workloads,
          },
          {
            icon: <Computer sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
            label: "Platforms",
            value: stats.platforms,
          },
          {
            icon: <Settings sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
            label: "Scenarios",
            value: stats.scenarios,
          },
          {
            icon: <Code sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
            label: "Strategies",
            value: stats.strategies,
          },
          {
            icon: <Science sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
            label: "Experiments",
            value: stats.experiments,
          },
          {
            icon: <Analytics sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />,
            label: "Results",
            value: stats.results,
          },
        ].map((stat) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={stat.label}>
            <Card
              sx={{
                p: 3,
                textAlign: "center",
                borderRadius: 1,
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

      {/* Main Content: Experiments Overview & Quick Actions */}
      <Grid container spacing={3} sx={{ mb: 2 }}>
        <Grid item xs={12} md={8}>
          <Card
            sx={{
              p: 4,
              borderRadius: 1,
              background: "rgba(24,34,53,0.98)",
              boxShadow: "0 2px 12px 0 rgba(0,224,211,0.04)",
            }}
          >
            <Typography variant="h6" fontWeight={900} gutterBottom>
              Experiments Overview
            </Typography>
            <Stack direction="row" spacing={2} mb={2}>
              <Chip
                label={`${stats.runningExperiments} Running`}
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 700, px: 2 }}
              />
              <Chip
                label={`${stats.completedExperiments} Completed`}
                color="success"
                variant="outlined"
                sx={{ fontWeight: 700, px: 2 }}
              />
              <Chip
                label={`${stats.results} Results`}
                color="secondary"
                variant="outlined"
                sx={{ fontWeight: 700, px: 2 }}
              />
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: 16 }}
            >
              Monitor the status of your experiments in real time. View running,
              completed, and failed experiments, and access detailed results and
              analytics.
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              p: 4,
              borderRadius: 1,
              background: "rgba(24,34,53,0.98)",
              boxShadow: "0 2px 12px 0 rgba(0,224,211,0.04)",
            }}
          >
            <Typography variant="h6" fontWeight={900} gutterBottom>
              Quick Actions
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="outlined"
                color="primary"
                href="/workloads"
                fullWidth
                sx={{ fontWeight: 700, borderRadius: 1, borderWidth: 2 }}
              >
                Upload New Workload
              </Button>
              <Button
                variant="outlined"
                color="primary"
                href="/platforms"
                fullWidth
                sx={{ fontWeight: 700, borderRadius: 1, borderWidth: 2 }}
              >
                Upload New Platform
              </Button>
              <Button
                variant="outlined"
                color="primary"
                href="/strategies"
                fullWidth
                sx={{ fontWeight: 700, borderRadius: 1, borderWidth: 2 }}
              >
                Upload New Strategy
              </Button>
              <Button
                variant="outlined"
                color="primary"
                href="/scenarios"
                fullWidth
                sx={{ fontWeight: 700, borderRadius: 1, borderWidth: 2 }}
              >
                Create Scenario
              </Button>
              <Button
                variant="contained"
                color="primary"
                href="/experiments"
                fullWidth
                sx={{ fontWeight: 900, borderRadius: 1, py: 1.5 }}
              >
                Start New Experiment
              </Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
