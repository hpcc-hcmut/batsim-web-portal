import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Chip,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { resultsAPI, TimelineResponse } from "../../services/api";
import { TimelineCursorProvider } from "../../utils/timeline-cursor-context";
import { ScheduleGantt } from "./schedule-gantt";
import { TimelineLineChart } from "./timeline-line-chart";
import { WaitingCdfChart } from "./waiting-cdf-chart";

interface Props {
  resultId: number;
}

// Truncation cap requested from backend — bounds the bar-count the Gantt has to draw
// and switches to density mode automatically when exceeded.
const DEFAULT_TIMELINE_LIMIT = 5000;
const DENSITY_TRIGGER_BARS = 2000;

/**
 * Owner of the Replay tab. Fetches the timeline payload once, hosts the shared
 * TimelineCursorProvider, and lays out the 4 synchronized panels: Gantt + utilization
 * + queue depth (share time axis + cursor), and the waiting-time CDF (independent axis).
 *
 * Time-range slider zooms the 3 time-axis panels in lockstep; CDF stays full.
 * Density mode flips ScheduleGantt to a single sceneFunc-rendered Layer when the
 * bar count blows past the React-Konva reconciliation ceiling.
 */
export function ReplayView({ resultId }: Props) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [densityOverride, setDensityOverride] = useState<"auto" | "on" | "off">("auto");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setRange(null);
    resultsAPI
      .getTimeline(resultId, DEFAULT_TIMELINE_LIMIT)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setRange([0, res.data.makespan || 0]);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load timeline";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resultId]);

  // Filter jobs + time series to the visible window. Aggregates remain meaningful
  // because backend computes them over the full set before truncation.
  const visible = useMemo(() => {
    if (!data || !range) return null;
    const [t0, t1] = range;
    const jobsInWindow = data.jobs.filter((j) => {
      const start = j.starting_time ?? j.submission_time;
      const end = j.finish_time ?? start;
      // Overlap test — bar visible if any part of [start,end] intersects [t0,t1].
      return end >= t0 && start <= t1;
    });
    const utilWindow = data.utilization_series.filter((p) => p.t >= t0 && p.t <= t1);
    const queueWindow = data.queue_series.filter((p) => p.t >= t0 && p.t <= t1);
    return { jobsInWindow, utilWindow, queueWindow };
  }, [data, range]);

  // Total bar count for density decision — based on the FULL job set (data.jobs), not the
  // currently-visible window. Otherwise the slider would flip density mode mid-drag whenever
  // the user zooms below the threshold (visual flicker). Only count jobs that will actually
  // render bars (started + finished) — queued-but-never-started don't contribute bars and
  // would otherwise inflate the count, falsely triggering density.
  const totalBars = useMemo(() => {
    if (!data) return 0;
    return data.jobs.reduce((sum, j) => {
      if (j.starting_time == null || j.finish_time == null) return sum;
      return sum + (j.allocated_resources.length || j.requested_resources || 0);
    }, 0);
  }, [data]);

  const useDensity =
    densityOverride === "on" ||
    (densityOverride === "auto" && (data?.truncated || totalBars > DENSITY_TRIGGER_BARS));

  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 4 }}>
        <CircularProgress size={20} />
        <Typography variant="body2">Đang nạp timeline…</Typography>
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data || !visible || !range) {
    return <Alert severity="warning">Không có dữ liệu timeline cho result này.</Alert>;
  }

  return (
    <TimelineCursorProvider>
      <Stack spacing={1} sx={{ pt: 1 }}>
        {/* Header chips — quick context for the researcher */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip size="small" label={`${data.total_jobs} jobs`} />
          <Chip size="small" label={`${data.n_hosts} hosts`} />
          <Chip size="small" label={`makespan ${data.makespan.toFixed(1)}s`} />
          {data.truncated && (
            <Chip
              size="small"
              color="warning"
              label={`truncated → first ${data.jobs.length} jobs (aggregates over full set)`}
            />
          )}
          <Box sx={{ flex: 1 }} />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={useDensity}
                onChange={(_, on) => setDensityOverride(on ? "on" : "off")}
              />
            }
            label={
              <Typography variant="caption">Density mode</Typography>
            }
          />
        </Stack>

        {/* Gantt — main panel */}
        <ScheduleGantt
          jobs={visible.jobsInWindow}
          nHosts={data.n_hosts}
          makespan={data.makespan}
          tStart={range[0]}
          tEnd={range[1]}
          density={useDensity}
          height={Math.min(520, Math.max(180, 24 + data.n_hosts * 8))}
        />

        {/* Utilization over time — shares x-axis + cursor with Gantt */}
        <TimelineLineChart
          title="Utilization (busy / hosts)"
          series={visible.utilWindow}
          yMin={0}
          yMax={1}
          yFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          tMin={range[0]}
          tMax={range[1]}
          color="#1976d2"
        />

        {/* Queue depth over time */}
        <TimelineLineChart
          title="Queue depth (waiting jobs)"
          series={visible.queueWindow}
          yMin={0}
          tMin={range[0]}
          tMax={range[1]}
          color="#ef6c00"
        />

        {/* Time-range slider — zooms Gantt + utilization + queue together */}
        <Box sx={{ px: 2, pt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Time window: {range[0].toFixed(1)}s – {range[1].toFixed(1)}s
          </Typography>
          <Slider
            value={range}
            min={0}
            max={data.makespan || 1}
            step={Math.max(0.1, (data.makespan || 1) / 1000)}
            onChange={(_, v) => setRange(v as [number, number])}
            valueLabelDisplay="auto"
            disableSwap
            size="small"
          />
        </Box>

        {/* Waiting CDF — axis is waiting time (not simulation time), so independent */}
        <WaitingCdfChart series={data.waiting_cdf} />
      </Stack>
    </TimelineCursorProvider>
  );
}
