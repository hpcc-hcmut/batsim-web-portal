import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  Grid,
  Stack,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
} from "@mui/material";
import {
  Analytics,
  TrendingUp,
  TrendingDown,
  Compare,
  Download,
} from "@mui/icons-material";
import { mockAnalyticsData, mockResults, mockStrategies } from "../mockData";

const AnalyticsDemo: React.FC = () => {
  const [timeRange, setTimeRange] = useState("30d");
  const [selectedMetric, setSelectedMetric] = useState("makespan");

  const analytics = mockAnalyticsData;

  // Calculate strategy comparison data
  const strategyComparison = mockStrategies.map((strategy) => {
    const strategyResults = mockResults.filter((r) => r.strategy_name === strategy.name);
    const avgMakespan = strategyResults.length > 0
      ? strategyResults.reduce((acc, r) => acc + r.makespan, 0) / strategyResults.length
      : 0;
    const avgUtilization = strategyResults.length > 0
      ? strategyResults.reduce((acc, r) => acc + r.resource_utilization, 0) / strategyResults.length
      : 0;
    const avgWaitTime = strategyResults.length > 0
      ? strategyResults.reduce((acc, r) => acc + r.average_waiting_time, 0) / strategyResults.length
      : 0;
    return {
      name: strategy.name,
      experiments: strategyResults.length,
      avgMakespan,
      avgUtilization,
      avgWaitTime,
    };
  });

  const getTrendIcon = (value: number) => {
    return value >= 0 ? (
      <TrendingUp sx={{ color: "#4caf50", fontSize: 18 }} />
    ) : (
      <TrendingDown sx={{ color: "#f44336", fontSize: 18 }} />
    );
  };

  const formatTrend = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} gutterBottom>
            Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Analyze simulation performance trends and compare scheduling strategies
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
              <MenuItem value="all">All time</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<Download />}
            sx={{ borderRadius: 1, fontWeight: 700 }}
          >
            Export
          </Button>
        </Stack>
      </Box>

      {/* Key Metrics Overview */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h4" fontWeight={700} sx={{ color: "#4a9eff" }}>
                  {analytics.total_experiments}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Experiments
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                {getTrendIcon(analytics.experiment_trend)}
                <Typography variant="caption" color="text.secondary">
                  {formatTrend(analytics.experiment_trend)}
                </Typography>
              </Stack>
            </Stack>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h4" fontWeight={700} sx={{ color: "#4caf50" }}>
                  {analytics.avg_utilization.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Utilization
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                {getTrendIcon(analytics.utilization_trend)}
                <Typography variant="caption" color="text.secondary">
                  {formatTrend(analytics.utilization_trend)}
                </Typography>
              </Stack>
            </Stack>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h4" fontWeight={700} sx={{ color: "#ff9800" }}>
                  {analytics.avg_makespan.toFixed(0)}s
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Makespan
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                {getTrendIcon(-analytics.makespan_trend)}
                <Typography variant="caption" color="text.secondary">
                  {formatTrend(analytics.makespan_trend)}
                </Typography>
              </Stack>
            </Stack>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {analytics.success_rate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Success Rate
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                {getTrendIcon(analytics.success_trend)}
                <Typography variant="caption" color="text.secondary">
                  {formatTrend(analytics.success_trend)}
                </Typography>
              </Stack>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Performance Over Time */}
        <Grid item xs={12} md={8}>
          <Card sx={{ p: 3, background: "rgba(26,32,44,0.98)", borderRadius: 2, height: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight={700}>
                Performance Over Time
              </Typography>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <Select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  size="small"
                >
                  <MenuItem value="makespan">Makespan</MenuItem>
                  <MenuItem value="utilization">Utilization</MenuItem>
                  <MenuItem value="waiting_time">Waiting Time</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            {/* Simulated Chart Area */}
            <Box
              sx={{
                height: 250,
                background: "rgba(74,158,255,0.05)",
                borderRadius: 2,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-around",
                p: 2,
                pt: 4,
              }}
            >
              {analytics.performance_data.map((point, i) => (
                <Box key={i} sx={{ textAlign: "center", flex: 1 }}>
                  <Box
                    sx={{
                      width: 24,
                      height: `${point.value * 2}px`,
                      background: `linear-gradient(180deg, #4a9eff 0%, rgba(74,158,255,0.3) 100%)`,
                      borderRadius: "4px 4px 0 0",
                      mx: "auto",
                      mb: 1,
                      transition: "height 0.3s ease",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {point.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Card>
        </Grid>

        {/* Distribution Chart */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3, background: "rgba(26,32,44,0.98)", borderRadius: 2, height: "100%" }}>
            <Typography variant="h6" fontWeight={700} mb={2}>
              Experiment Status Distribution
            </Typography>
            <Stack spacing={2}>
              {[
                { label: "Completed", value: 65, color: "#4caf50" },
                { label: "Running", value: 20, color: "#4a9eff" },
                { label: "Failed", value: 10, color: "#f44336" },
                { label: "Pending", value: 5, color: "#ff9800" },
              ].map((item) => (
                <Box key={item.label}>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {item.value}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={item.value}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      backgroundColor: "rgba(255,255,255,0.1)",
                      "& .MuiLinearProgress-bar": {
                        backgroundColor: item.color,
                        borderRadius: 1,
                      },
                    }}
                  />
                </Box>
              ))}
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Strategy Comparison */}
      <Card sx={{ p: 3, background: "rgba(26,32,44,0.98)", borderRadius: 2, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <Compare sx={{ color: "#4a9eff" }} />
          <Typography variant="h6" fontWeight={700}>
            Strategy Comparison
          </Typography>
        </Stack>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Strategy</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Experiments</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Avg Makespan</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Avg Utilization</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Avg Wait Time</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Performance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {strategyComparison.map((strategy) => {
                const performanceScore = strategy.avgUtilization * 0.4 + (100 - strategy.avgMakespan / 10) * 0.3 + (100 - strategy.avgWaitTime) * 0.3;
                return (
                  <TableRow key={strategy.name} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Analytics sx={{ color: "#4a9eff", fontSize: 20 }} />
                        <Typography fontWeight={600}>{strategy.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={strategy.experiments} size="small" color="primary" />
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontWeight={600}>
                        {strategy.avgMakespan > 0 ? `${strategy.avgMakespan.toFixed(1)}s` : "-"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={strategy.avgUtilization > 0 ? `${strategy.avgUtilization.toFixed(1)}%` : "-"}
                        size="small"
                        color={
                          strategy.avgUtilization > 80
                            ? "success"
                            : strategy.avgUtilization > 60
                            ? "warning"
                            : "default"
                        }
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontWeight={600}>
                        {strategy.avgWaitTime > 0 ? `${strategy.avgWaitTime.toFixed(1)}s` : "-"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Box sx={{ width: 80, mr: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(Math.max(performanceScore, 0), 100)}
                            sx={{
                              height: 6,
                              borderRadius: 1,
                              backgroundColor: "rgba(255,255,255,0.1)",
                              "& .MuiLinearProgress-bar": {
                                backgroundColor:
                                  performanceScore > 70
                                    ? "#4caf50"
                                    : performanceScore > 50
                                    ? "#ff9800"
                                    : "#f44336",
                                borderRadius: 1,
                              },
                            }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {performanceScore > 0 ? performanceScore.toFixed(0) : "-"}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Recent Activity & Insights */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>
              Top Performing Experiments
            </Typography>
            <Stack spacing={2}>
              {mockResults
                .sort((a, b) => b.resource_utilization - a.resource_utilization)
                .slice(0, 5)
                .map((result, i) => (
                  <Stack
                    key={result.id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      background: "rgba(74,158,255,0.05)",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "rgba(74,158,255,0.2)",
                          color: i < 3 ? "#1a202c" : "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                        }}
                      >
                        {i + 1}
                      </Typography>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {result.experiment_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {result.strategy_name}
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip
                      label={`${result.resource_utilization.toFixed(1)}%`}
                      size="small"
                      color="success"
                    />
                  </Stack>
                ))}
            </Stack>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>
              Insights & Recommendations
            </Typography>
            <Stack spacing={2}>
              {[
                {
                  title: "Best Strategy for Large Workloads",
                  description: "Backfill (EASY) shows 15% better utilization on workloads with 100+ jobs",
                  type: "success",
                },
                {
                  title: "High Waiting Times Detected",
                  description: "FCFS strategy shows above-average waiting times. Consider switching to SJF for batch jobs.",
                  type: "warning",
                },
                {
                  title: "Optimal Platform Configuration",
                  description: "Cluster configurations with 128 hosts show best performance-to-cost ratio",
                  type: "info",
                },
                {
                  title: "Resource Utilization Improvement",
                  description: "Overall utilization improved by 8.5% this month compared to last month",
                  type: "success",
                },
              ].map((insight, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    background:
                      insight.type === "success"
                        ? "rgba(76,175,80,0.1)"
                        : insight.type === "warning"
                        ? "rgba(255,152,0,0.1)"
                        : "rgba(74,158,255,0.1)",
                    borderLeft: `3px solid ${
                      insight.type === "success"
                        ? "#4caf50"
                        : insight.type === "warning"
                        ? "#ff9800"
                        : "#4a9eff"
                    }`,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700}>
                    {insight.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {insight.description}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsDemo;
