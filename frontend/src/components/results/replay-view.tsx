import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Chip,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
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
import { HostUtilizationHeatmap } from "./host-utilization-heatmap";
import { JobStateStackedArea } from "./job-state-stacked-area";

interface Props {
  resultId: number;
}

const DENSITY_TRIGGER_BARS = 2000;
const LIMIT_OPTIONS = [
  { value: 1000, label: "1,000 jobs" },
  { value: 2000, label: "2,000 jobs" },
  { value: 5000, label: "5,000 jobs" },
  { value: 10000, label: "10,000 jobs" },
  { value: 0, label: "All (may be slow)" },
];

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
  const [hostRange, setHostRange] = useState<[number, number] | null>(null);
  const [densityOverride, setDensityOverride] = useState<"auto" | "on" | "off">("auto");
  const [jobLimit, setJobLimit] = useState(5000);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setRange(null);
    resultsAPI
      .getTimeline(resultId, jobLimit || undefined)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setRange([0, res.data.makespan || 0]);
        // Default host range: first 64 hosts (readable at ~7px/row). Show all if fewer.
        setHostRange([0, Math.min(64, res.data.n_hosts)]);
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
  }, [resultId, jobLimit]);

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
    const runningWindow = (data.running_series ?? []).filter((p) => p.t >= t0 && p.t <= t1);
    const completedWindow = (data.completed_series ?? []).filter((p) => p.t >= t0 && p.t <= t1);
    return { jobsInWindow, utilWindow, queueWindow, runningWindow, completedWindow };
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
        <Typography variant="body2">Loading timeline…</Typography>
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data || !visible || !range || !hostRange) {
    return <Alert severity="warning">No timeline data available for this result.</Alert>;
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
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select
              value={jobLimit}
              onChange={(e) => setJobLimit(Number(e.target.value))}
              sx={{ fontSize: 12, height: 28 }}
            >
              {LIMIT_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 12 }}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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

        {/* Controls panel — sliders ABOVE Gantt for discoverability (P3) */}
        <Box sx={{ px: 1, display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
          <Box sx={{ flex: "1 1 300px", minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary">
              Time: {range[0].toFixed(0)}s – {range[1].toFixed(0)}s
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
          {data.n_hosts > 1 && (
            <Box sx={{ flex: "1 1 200px", minWidth: 150 }}>
              {/* "info" (light blue), NOT "secondary": secondary renders gray on the
                  dark theme and reads as a disabled slider (user feedback 07/06) */}
              <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600 }}>
                Hosts: {hostRange[0]} – {Math.max(hostRange[0], hostRange[1] - 1)} of {data.n_hosts}
              </Typography>
              <Slider
                value={hostRange}
                min={0}
                max={data.n_hosts}
                step={1}
                onChange={(_, v) => {
                  let [a, b] = v as [number, number];
                  // giữ tối thiểu 1 host khi 2 thanh trượt trùng nhau (tránh cửa sổ rỗng + nhãn "88 – 87")
                  if (b - a < 1) {
                    if (b >= data.n_hosts) a = b - 1;
                    else b = a + 1;
                  }
                  setHostRange([a, b]);
                }}
                valueLabelDisplay="auto"
                disableSwap
                size="small"
                color="info"
              />
            </Box>
          )}
        </Box>

        {/* Gantt — main panel */}
        <ScheduleGantt
          jobs={visible.jobsInWindow}
          nHosts={data.n_hosts}
          makespan={data.makespan}
          tStart={range[0]}
          tEnd={range[1]}
          hostStart={hostRange[0]}
          hostEnd={hostRange[1]}
          density={useDensity}
          height={Math.min(520, Math.max(180, 24 + (hostRange[1] - hostRange[0]) * 8))}
        />

        {/* Host x Time heatmap — compressed schedule view that stays readable
            where a 50k-job Gantt turns to noise. Server-aggregated over ALL jobs,
            so density-mode truncation never distorts it. */}
        <HostUtilizationHeatmap
          resultId={resultId}
          tStart={range[0]}
          tEnd={range[1]}
          hostStart={hostRange[0]}
          hostEnd={hostRange[1]}
          height={Math.min(300, Math.max(120, (hostRange[1] - hostRange[0]) * 4))}
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

        {/* Job-state composition (stacked). The amber "waiting" layer IS the old
            queue-depth line, now with running + completed context on the same axis.
            Falls back to the plain queue line for results predating the new series. */}
        {(visible.runningWindow.length || visible.completedWindow.length) ? (
          <JobStateStackedArea
            waiting={visible.queueWindow}
            running={visible.runningWindow}
            completed={visible.completedWindow}
            tMin={range[0]}
            tMax={range[1]}
          />
        ) : (
          <TimelineLineChart
            title="Queue depth (waiting jobs)"
            series={visible.queueWindow}
            yMin={0}
            tMin={range[0]}
            tMax={range[1]}
            color="#ef6c00"
          />
        )}

        {/* Waiting CDF — axis is waiting time (not simulation time), so independent */}
        <WaitingCdfChart series={data.waiting_cdf} />
      </Stack>
    </TimelineCursorProvider>
  );
}
