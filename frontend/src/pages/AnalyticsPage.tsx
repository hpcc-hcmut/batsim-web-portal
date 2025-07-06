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
  Paper,
  Divider,
  TextField,
  Button,
} from "@mui/material";
import {
  Analytics,
  Timeline,
  TrendingUp,
  Speed,
  CheckCircle,
  Error,
  Schedule,
  Storage,
  Science,
} from "@mui/icons-material";
import { resultsAPI } from "../services/api";

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
  top_strategies: Array<{ name: string; count: number }>;
  top_scenarios: Array<{ name: string; count: number }>;
}

const AnalyticsPage: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await resultsAPI.getAnalytics(params);
      setAnalyticsData(res.data);
    } catch (err: any) {
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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" sx={{ mt: 4 }}>
        {error}
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Analytics Dashboard
      </Typography>

      {/* Date Filters */}
      <Card sx={{ mb: 3, borderRadius: 1, background: "rgba(26,32,44,0.98)" }}>
        <CardContent>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{ mb: 2, color: "#fff" }}
          >
            Date Range Filter
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              type="date"
              label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            />
            <TextField
              type="date"
              label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
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
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 1, background: "rgba(26,32,44,0.98)" }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Analytics sx={{ fontSize: 36, color: "#4a9eff" }} />
                    <Box>
                      <Typography
                        variant="h4"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
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

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 1, background: "rgba(24,34,53,0.98)" }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Science sx={{ fontSize: 36, color: "#4a9eff" }} />
                    <Box>
                      <Typography
                        variant="h4"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
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

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 1, background: "rgba(24,34,53,0.98)" }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <CheckCircle sx={{ fontSize: 36, color: "#4a9eff" }} />
                    <Box>
                      <Typography
                        variant="h4"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
                        {analyticsData.success_rate}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Success Rate
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 1, background: "rgba(24,34,53,0.98)" }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Storage sx={{ fontSize: 36, color: "#4a9eff" }} />
                    <Box>
                      <Typography
                        variant="h4"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
                        {analyticsData.total_jobs}
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

          {/* Performance Metrics */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 1, background: "rgba(24,34,53,0.98)" }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{ mb: 2, color: "#fff" }}
                  >
                    Performance Metrics
                  </Typography>
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Speed sx={{ color: "#4a9eff" }} />
                        <Typography variant="body2" color="text.secondary">
                          Avg Makespan
                        </Typography>
                      </Stack>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        sx={{ color: "#fff" }}
                      >
                        {analyticsData.avg_makespan}s
                      </Typography>
                    </Box>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Schedule sx={{ color: "#4a9eff" }} />
                        <Typography variant="body2" color="text.secondary">
                          Avg Waiting Time
                        </Typography>
                      </Stack>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        sx={{ color: "#fff" }}
                      >
                        {analyticsData.avg_waiting_time}s
                      </Typography>
                    </Box>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Timeline sx={{ color: "#4a9eff" }} />
                        <Typography variant="body2" color="text.secondary">
                          Avg Turnaround Time
                        </Typography>
                      </Stack>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        sx={{ color: "#fff" }}
                      >
                        {analyticsData.avg_turnaround_time}s
                      </Typography>
                    </Box>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <TrendingUp sx={{ color: "#4a9eff" }} />
                        <Typography variant="body2" color="text.secondary">
                          Avg Resource Utilization
                        </Typography>
                      </Stack>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        sx={{ color: "#fff" }}
                      >
                        {analyticsData.avg_resource_utilization}%
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 1, background: "rgba(24,34,53,0.98)" }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{ mb: 2, color: "#fff" }}
                  >
                    Job Statistics
                  </Typography>
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Completed Jobs
                      </Typography>
                      <Chip
                        label={analyticsData.completed_jobs}
                        color="success"
                        size="small"
                      />
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Failed Jobs
                      </Typography>
                      <Chip
                        label={analyticsData.failed_jobs}
                        color="error"
                        size="small"
                      />
                    </Box>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Success Rate
                      </Typography>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        sx={{ color: "#4a9eff" }}
                      >
                        {analyticsData.success_rate}%
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Top Strategies and Scenarios */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 1, background: "rgba(24,34,53,0.98)" }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{ mb: 2, color: "#fff" }}
                  >
                    Top Strategies
                  </Typography>
                  {analyticsData.top_strategies.length > 0 ? (
                    <Stack spacing={1}>
                      {analyticsData.top_strategies.map((strategy, index) => (
                        <Box
                          key={strategy.name}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            p: 1,
                            borderRadius: 1,
                            background: "rgba(255,255,255,0.04)",
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {strategy.name}
                          </Typography>
                          <Chip
                            label={strategy.count}
                            size="small"
                            color="primary"
                          />
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No strategy data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 1, background: "rgba(24,34,53,0.98)" }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{ mb: 2, color: "#fff" }}
                  >
                    Top Scenarios
                  </Typography>
                  {analyticsData.top_scenarios.length > 0 ? (
                    <Stack spacing={1}>
                      {analyticsData.top_scenarios.map((scenario, index) => (
                        <Box
                          key={scenario.name}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            p: 1,
                            borderRadius: 1,
                            background: "rgba(255,255,255,0.04)",
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {scenario.name}
                          </Typography>
                          <Chip
                            label={scenario.count}
                            size="small"
                            color="secondary"
                          />
                        </Box>
                      ))}
                    </Stack>
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
