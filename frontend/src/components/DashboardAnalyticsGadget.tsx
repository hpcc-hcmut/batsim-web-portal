import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  PlayArrow,
  HourglassEmpty,
  CheckCircle,
  ErrorOutline,
} from "@mui/icons-material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { experimentsAPI, Experiment } from "../services/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Dashboard analytics (Option A): compute aggregates client-side from the
// existing /api/experiments/ endpoint. Drops misleading per-job averages
// (avg_makespan, avg_waiting_time, success_rate) since they aggregate across
// heterogeneous workloads — e.g. 10-job demo vs 200k-job PWA trace —
// producing values that have no statistical meaning.

const STATUS_COLORS: Record<string, string> = {
  completed: "#51cf66",
  failed: "#ff6b6b",
  cancelled: "#ffd43b",
  running: "#4a9eff",
  queued: "#a0aec0",
  pending: "#a0aec0",
  paused: "#cc5de8",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDayLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function durationSeconds(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return Math.max(0, (e - s) / 1000);
}

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = Date.now() - t;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

const DashboardAnalyticsGadget: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Single endpoint: /api/experiments/ returns all data we need.
        // Queue counts are derived from status filtering — avoids an extra
        // call to /api/experiments/queue/ which returns 307 redirect.
        const expRes = await experimentsAPI.getAll({ limit: 200 });
        setExperiments(expRes.data);
      } catch (err: any) {
        setError("Failed to load dashboard analytics.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Aggregate stats computed client-side. Filters by status + recency window.
  const stats = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    let running = 0;
    let queued = 0;
    let completed7d = 0;
    let failed7d = 0;
    for (const exp of experiments) {
      if (exp.status === "running") running++;
      else if (exp.status === "queued") queued++;
      const endTime = exp.end_time ? new Date(exp.end_time).getTime() : null;
      if (endTime != null && endTime >= sevenDaysAgo) {
        if (exp.status === "completed") completed7d++;
        else if (exp.status === "failed") failed7d++;
      }
    }
    return { running, queued, completed7d, failed7d };
  }, [experiments]);

  // Activity chart: bucket experiments by end_time day, last 14 days, by status
  const chartData = useMemo(() => {
    const days: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const completedByDay = new Array(14).fill(0);
    const failedByDay = new Array(14).fill(0);
    const cancelledByDay = new Array(14).fill(0);
    for (const exp of experiments) {
      if (!exp.end_time) continue;
      const endDay = startOfDay(new Date(exp.end_time)).getTime();
      const idx = days.findIndex((d) => d.getTime() === endDay);
      if (idx < 0) continue;
      if (exp.status === "completed") completedByDay[idx]++;
      else if (exp.status === "failed") failedByDay[idx]++;
      else if (exp.status === "cancelled") cancelledByDay[idx]++;
    }
    return {
      labels: days.map(formatDayLabel),
      datasets: [
        {
          label: "Completed",
          data: completedByDay,
          backgroundColor: STATUS_COLORS.completed,
        },
        {
          label: "Failed",
          data: failedByDay,
          backgroundColor: STATUS_COLORS.failed,
        },
        {
          label: "Cancelled",
          data: cancelledByDay,
          backgroundColor: STATUS_COLORS.cancelled,
        },
      ],
    };
  }, [experiments]);

  // Recent 5 experiments sorted by end_time (fallback: created_at via id)
  const recent = useMemo(() => {
    return [...experiments]
      .sort((a, b) => {
        const ta = a.end_time ? new Date(a.end_time).getTime() : 0;
        const tb = b.end_time ? new Date(b.end_time).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return b.id - a.id;
      })
      .slice(0, 5);
  }, [experiments]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }
  if (error) {
    return (
      <Typography color="error" sx={{ my: 4 }}>
        {error}
      </Typography>
    );
  }

  const statCard = (
    icon: React.ReactNode,
    value: number | string,
    label: string,
    color: string,
  ) => (
    <Card sx={{ borderRadius: 1, background: "rgba(24,34,53,0.98)" }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ fontSize: 36, color, display: "flex" }}>{icon}</Box>
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ color: "#fff" }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ mb: 5 }}>
      {/* Section 1 — Operational status cards (real-time + last 7 days) */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          {statCard(
            <PlayArrow sx={{ fontSize: 36 }} />,
            stats.running,
            "Running",
            STATUS_COLORS.running,
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {statCard(
            <HourglassEmpty sx={{ fontSize: 36 }} />,
            stats.queued,
            "Queued",
            STATUS_COLORS.queued,
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {statCard(
            <CheckCircle sx={{ fontSize: 36 }} />,
            stats.completed7d,
            "Completed (7d)",
            STATUS_COLORS.completed,
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {statCard(
            <ErrorOutline sx={{ fontSize: 36 }} />,
            stats.failed7d,
            "Failed (7d)",
            STATUS_COLORS.failed,
          )}
        </Grid>
      </Grid>

      {/* Section 2 — Activity chart (14 days, stacked by status) */}
      <Card sx={{ borderRadius: 1, background: "rgba(24,34,53,0.98)", mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
            Activity (last 14 days)
          </Typography>
          <Box sx={{ height: 240 }}>
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: "top", labels: { color: "#e2e8f0" } },
                  tooltip: { mode: "index", intersect: false },
                },
                scales: {
                  x: {
                    stacked: true,
                    ticks: { color: "#a0aec0" },
                    grid: { color: "#2d3748" },
                  },
                  y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { color: "#a0aec0", precision: 0 },
                    grid: { color: "#2d3748" },
                  },
                },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Section 3 — Recent experiments table (5 rows) */}
      <Card sx={{ borderRadius: 1, background: "rgba(24,34,53,0.98)" }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "#fff" }}>
            Recent Experiments
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: "#a0aec0", fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ color: "#a0aec0", fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ color: "#a0aec0", fontWeight: 700 }} align="right">
                    Jobs
                  </TableCell>
                  <TableCell sx={{ color: "#a0aec0", fontWeight: 700 }} align="right">
                    Duration
                  </TableCell>
                  <TableCell sx={{ color: "#a0aec0", fontWeight: 700 }} align="right">
                    Ended
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recent.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: "#a0aec0" }}>
                      No experiments yet.
                    </TableCell>
                  </TableRow>
                )}
                {recent.map((exp) => {
                  const dur = durationSeconds(exp.start_time, exp.end_time);
                  return (
                    <TableRow key={exp.id}>
                      <TableCell sx={{ color: "#e2e8f0" }}>{exp.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={exp.status}
                          size="small"
                          sx={{
                            background: STATUS_COLORS[exp.status] || "#a0aec0",
                            color: "#0d1117",
                            fontWeight: 700,
                            textTransform: "capitalize",
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#e2e8f0" }}>
                        {exp.total_jobs ?? "—"}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#e2e8f0" }}>
                        {dur != null ? `${dur.toFixed(1)}s` : "—"}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#a0aec0" }}>
                        {relativeTime(exp.end_time)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DashboardAnalyticsGadget;
