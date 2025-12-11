/**
 * AnalyticsPage - Analytics dashboard with charts and metrics
 */

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Stack,
  Chip,
  Divider,
  TextField,
  Button,
  Alert,
} from "@mui/material";
import {
  Analytics,
  Timeline,
  TrendingUp,
  Speed,
  CheckCircle,
  Schedule,
  Storage,
  Science,
  FilterAlt,
  Download,
} from "@mui/icons-material";
import { resultsAPI } from "../services/api";
import {
  StrategyComparisonChart,
  ResultsTrendChart,
  JobDistributionChart,
  BarChartComponent,
} from "../components/analytics";

interface AnalyticsData {
  total_results: number;
  total_experiments: number;
  avg_makespan: number;
  avg_waiting_time: number;
  avg_turnaround_time: number;
  avg_resource_utilization: number;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  success_rate: number;
  results_by_date: Array<{ date: string; count: number }>;
  top_strategies: Array<{ name: string; count: number; avgMakespan?: number; avgWaitingTime?: number; avgTurnaroundTime?: number }>;
  top_scenarios: Array<{ name: string; count: number }>;
}

const AnalyticsPage: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await resultsAPI.getAnalytics(params);
      setAnalyticsData(res.data);
    } catch (err) {
      setError("Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleFilter = () => {
    fetchAnalytics();
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    fetchAnalytics();
  };

  const handleExportCSV = async () => {
    try {
      const params: Record<string, string> = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await resultsAPI.exportCSV(params);
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `results_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleExportJSON = async () => {
    try {
      const params: Record<string, string> = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await resultsAPI.exportJSON(params);
      const blob = new Blob([response.data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `results_export_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 4 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Analytics sx={{ fontSize: 36, color: "#4a9eff" }} />
          <Box>
            <Typography variant="h4" fontWeight={900}>
              Analytics Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Performance metrics, trends, and strategy comparison
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Download />}
            onClick={handleExportCSV}
            sx={{ borderRadius: 1 }}
          >
            CSV
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Download />}
            onClick={handleExportJSON}
            sx={{ borderRadius: 1 }}
          >
            JSON
          </Button>
        </Stack>
      </Stack>

      {/* Date Filters */}
      <Card sx={{ mb: 3, borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <FilterAlt sx={{ color: "#4a9eff" }} />
            <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
              Date Range Filter
            </Typography>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              type="date"
              label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              size="small"
              sx={{ minWidth: 180 }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="date"
              label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              size="small"
              sx={{ minWidth: 180 }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button
              variant="contained"
              onClick={handleFilter}
              sx={{ borderRadius: 1, fontWeight: 700 }}
            >
              Apply Filter
            </Button>
            <Button
              variant="outlined"
              onClick={handleClearFilters}
              sx={{ borderRadius: 1, fontWeight: 700 }}
            >
              Clear
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {analyticsData && (
        <>
          {/* Key Metrics */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderRadius: 2, background: "rgba(26,32,44,0.98)", height: "100%" }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Analytics sx={{ fontSize: 36, color: "#4a9eff" }} />
                    <Box>
                      <Typography variant="h4" fontWeight={900} sx={{ color: "#fff" }}>
                        {analyticsData.total_results}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Results
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderRadius: 2, background: "rgba(26,32,44,0.98)", height: "100%" }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Science sx={{ fontSize: 36, color: "#9c27b0" }} />
                    <Box>
                      <Typography variant="h4" fontWeight={900} sx={{ color: "#fff" }}>
                        {analyticsData.total_experiments}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Experiments
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderRadius: 2, background: "rgba(26,32,44,0.98)", height: "100%" }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <CheckCircle sx={{ fontSize: 36, color: "#4caf50" }} />
                    <Box>
                      <Typography variant="h4" fontWeight={900} sx={{ color: "#fff" }}>
                        {analyticsData.success_rate.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Success Rate
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderRadius: 2, background: "rgba(26,32,44,0.98)", height: "100%" }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Storage sx={{ fontSize: 36, color: "#ff9800" }} />
                    <Box>
                      <Typography variant="h4" fontWeight={900} sx={{ color: "#fff" }}>
                        {analyticsData.total_jobs.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Jobs
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts Row 1 */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <ResultsTrendChart data={analyticsData.results_by_date} height={300} />
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <JobDistributionChart
                completedJobs={analyticsData.completed_jobs}
                failedJobs={analyticsData.failed_jobs}
                height={300}
              />
            </Grid>
          </Grid>

          {/* Performance Metrics & Strategy Comparison */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: 2, background: "rgba(26,32,44,0.98)", height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
                    Performance Metrics
                  </Typography>
                  <Stack spacing={2}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Speed sx={{ color: "#4a9eff" }} />
                        <Typography variant="body2" color="text.secondary">
                          Avg Makespan
                        </Typography>
                      </Stack>
                      <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
                        {analyticsData.avg_makespan.toFixed(2)}s
                      </Typography>
                    </Box>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Schedule sx={{ color: "#ff9800" }} />
                        <Typography variant="body2" color="text.secondary">
                          Avg Waiting Time
                        </Typography>
                      </Stack>
                      <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
                        {analyticsData.avg_waiting_time.toFixed(2)}s
                      </Typography>
                    </Box>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Timeline sx={{ color: "#4caf50" }} />
                        <Typography variant="body2" color="text.secondary">
                          Avg Turnaround Time
                        </Typography>
                      </Stack>
                      <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
                        {analyticsData.avg_turnaround_time.toFixed(2)}s
                      </Typography>
                    </Box>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <TrendingUp sx={{ color: "#9c27b0" }} />
                        <Typography variant="body2" color="text.secondary">
                          Avg Resource Utilization
                        </Typography>
                      </Stack>
                      <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
                        {analyticsData.avg_resource_utilization.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: 2, background: "rgba(26,32,44,0.98)", height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
                    Job Statistics
                  </Typography>
                  <Stack spacing={2}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        Completed Jobs
                      </Typography>
                      <Chip
                        label={analyticsData.completed_jobs.toLocaleString()}
                        color="success"
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        Failed Jobs
                      </Typography>
                      <Chip
                        label={analyticsData.failed_jobs.toLocaleString()}
                        color="error"
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </Box>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        Success Rate
                      </Typography>
                      <Typography variant="h5" fontWeight={700} sx={{ color: "#4caf50" }}>
                        {analyticsData.success_rate.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Strategy Comparison Chart */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={12}>
              <StrategyComparisonChart
                strategies={analyticsData.top_strategies.map((s) => ({
                  name: s.name,
                  count: s.count,
                  avgMakespan: s.avgMakespan,
                  avgWaitingTime: s.avgWaitingTime,
                  avgTurnaroundTime: s.avgTurnaroundTime,
                }))}
              />
            </Grid>
          </Grid>

          {/* Top Strategies and Scenarios */}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
                    Top Strategies
                  </Typography>
                  {analyticsData.top_strategies.length > 0 ? (
                    <BarChartComponent
                      title=""
                      labels={analyticsData.top_strategies.map((s) => s.name)}
                      datasets={[
                        {
                          label: "Results",
                          data: analyticsData.top_strategies.map((s) => s.count),
                        },
                      ]}
                      height={200}
                      horizontal
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No strategy data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: 2, background: "rgba(26,32,44,0.98)" }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
                    Top Scenarios
                  </Typography>
                  {analyticsData.top_scenarios.length > 0 ? (
                    <BarChartComponent
                      title=""
                      labels={analyticsData.top_scenarios.map((s) => s.name)}
                      datasets={[
                        {
                          label: "Results",
                          data: analyticsData.top_scenarios.map((s) => s.count),
                          backgroundColor: "rgba(156, 39, 176, 0.7)",
                          borderColor: "rgba(156, 39, 176, 1)",
                        },
                      ]}
                      height={200}
                      horizontal
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No scenario data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default AnalyticsPage;
