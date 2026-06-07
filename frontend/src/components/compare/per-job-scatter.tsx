/**
 * Per-job scatter: the same job under strategy A (x) vs strategy B (y).
 * Valid ONLY because frozen inputs guarantee both runs executed the same
 * job set - the comparison no averaged metric can offer: it shows WHICH
 * jobs each strategy sacrifices (trade-offs vanish inside means).
 *
 * Reading: points below the y=x diagonal -> B handled that job better.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Chip, CircularProgress, MenuItem, Paper, Select, Stack, ToggleButton,
  ToggleButtonGroup, Typography,
} from "@mui/material";
import { Scatter } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import { resultsAPI, TimelineJob } from "../../services/api";
import {
  JoinResult, SCATTER_METRIC_LABELS, ScatterMetric, joinJobsByMetric,
} from "./per-job-join";
import { ChartExportButton } from "../common/chart-export-button";
import { exportCanvasPng } from "../../utils/export-chart-png";

const MAX_JOBS = 20000; // timeline endpoint cap; warn when a run exceeds it

export interface ScatterEntry {
  resultId: number;
  label: string;
  color: string;
}

interface Props {
  a: ScatterEntry;
  b: ScatterEntry;
}

export const PerJobScatter: React.FC<Props> = ({ a, b }) => {
  const [jobs, setJobs] = useState<{ a: TimelineJob[]; b: TimelineJob[] } | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<ScatterMetric>("waiting_time");
  const [scale, setScale] = useState<"linear" | "logarithmic">("linear");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      resultsAPI.getTimeline(a.resultId, MAX_JOBS),
      resultsAPI.getTimeline(b.resultId, MAX_JOBS),
    ])
      .then(([ra, rb]) => {
        if (cancelled) return;
        setJobs({ a: ra.data.jobs, b: rb.data.jobs });
        setTruncated(ra.data.truncated || rb.data.truncated);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load per-job data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [a.resultId, b.resultId]);

  const joined: JoinResult | null = useMemo(
    () => (jobs ? joinJobsByMetric(jobs.a, jobs.b, metric) : null),
    [jobs, metric],
  );

  const chart = useMemo(() => {
    if (!joined || !joined.points.length) return null;
    // Log scale cannot plot 0 - clamp to a small epsilon and say so in the axis title
    const clamp = (v: number) => (scale === "logarithmic" ? Math.max(v, 0.01) : v);
    const maxVal = Math.max(
      ...joined.points.map((p) => Math.max(p.a, p.b)),
      0.01,
    );
    const diagMin = scale === "logarithmic" ? 0.01 : 0;
    return {
      data: {
        datasets: [
          {
            type: "scatter" as const,
            label: `jobs (${joined.points.length})`,
            data: joined.points.map((p) => ({ x: clamp(p.a), y: clamp(p.b), jobId: p.jobId, res: p.requestedResources })),
            // Side coloring: green = B better (below diagonal), red = B worse, gray = tie
            pointBackgroundColor: joined.points.map((p) =>
              p.b < p.a ? "#51cf66cc" : p.b > p.a ? "#ff6b6bcc" : "#9e9e9ecc",
            ),
            pointBorderWidth: 0,
            pointRadius: joined.points.length > 2000 ? 2 : 4,
          },
          {
            type: "line" as const,
            label: "y = x (equal)",
            data: [
              { x: diagMin, y: diagMin },
              { x: maxVal, y: maxVal },
            ],
            borderColor: "#a0aec0",
            borderDash: [6, 6],
            borderWidth: 1,
            pointRadius: 0,
          },
        ],
      },
      maxVal,
    };
  }, [joined, scale]);

  return (
    <Paper sx={{ p: 3, mb: 3, position: "relative" }}>
      {chart && (
        <ChartExportButton
          top={12}
          right={12}
          onExport={() =>
            chartRef.current && exportCanvasPng(chartRef.current.canvas, `per-job-${metric}`)
          }
        />
      )}
      <Typography variant="h6" gutterBottom>
        Per-job Comparison
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        Every dot is ONE job under both strategies (identical frozen workload). X = {a.label},
        Y = {b.label}. Dots below the dashed diagonal: {b.label} handled that job better.
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
        <Select size="small" value={metric} onChange={(e) => setMetric(e.target.value as ScatterMetric)} sx={{ fontSize: 13 }}>
          {(Object.keys(SCATTER_METRIC_LABELS) as ScatterMetric[]).map((m) => (
            <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>{SCATTER_METRIC_LABELS[m]}</MenuItem>
          ))}
        </Select>
        <ToggleButtonGroup size="small" exclusive value={scale} onChange={(_, v) => v && setScale(v)}>
          <ToggleButton value="linear" sx={{ px: 1, py: 0.25, fontSize: 11 }}>Linear</ToggleButton>
          <ToggleButton value="logarithmic" sx={{ px: 1, py: 0.25, fontSize: 11 }}>Log</ToggleButton>
        </ToggleButtonGroup>
        {joined && joined.points.length > 0 && (
          <Chip
            size="small"
            color={joined.bBetter >= joined.aBetter ? "success" : "error"}
            variant="outlined"
            label={`${b.label} better on ${joined.bBetter}/${joined.points.length} jobs · ${a.label} on ${joined.aBetter} · tie ${joined.equal}`}
          />
        )}
        {joined && joined.skipped > 0 && (
          <Typography variant="caption" color="text.secondary">
            {joined.skipped} jobs skipped (missing metric / not in both runs)
          </Typography>
        )}
      </Stack>

      {truncated && (
        <Alert severity="warning" sx={{ mb: 1, py: 0.25 }}>
          Showing the first {MAX_JOBS.toLocaleString()} jobs per run - larger runs are truncated.
        </Alert>
      )}

      {loading ? (
        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}><CircularProgress size={24} /></Box>
      ) : error ? (
        <Alert severity="warning">{error}</Alert>
      ) : chart ? (
        <Box sx={{ height: 380, maxWidth: 560 }}>
          <Scatter
            ref={(instance) => { chartRef.current = instance; }}
            // Mixed scatter + diagonal line datasets - chart.js renders this fine,
            // but the per-type generics reject the union; single deliberate cast.
            data={chart.data as unknown as ChartData<"scatter">}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const raw = ctx.raw as { x: number; y: number; jobId?: string; res?: number };
                      return raw.jobId
                        ? `${raw.jobId} (${raw.res} res): ${a.label}=${raw.x.toFixed(1)}, ${b.label}=${raw.y.toFixed(1)}`
                        : "";
                    },
                  },
                },
              },
              scales: {
                x: {
                  type: scale,
                  title: { display: true, text: `${a.label} - ${SCATTER_METRIC_LABELS[metric]}${scale === "logarithmic" ? " (0 shown as 0.01)" : ""}`, color: "#a0aec0" },
                  ticks: { color: "#a0aec0" },
                  grid: { color: "#2d3748" },
                },
                y: {
                  type: scale,
                  title: { display: true, text: `${b.label} - ${SCATTER_METRIC_LABELS[metric]}`, color: "#a0aec0" },
                  ticks: { color: "#a0aec0" },
                  grid: { color: "#2d3748" },
                },
              },
            }}
          />
        </Box>
      ) : (
        <Alert severity="info">No comparable jobs between the two runs.</Alert>
      )}
    </Paper>
  );
};

export default PerJobScatter;
