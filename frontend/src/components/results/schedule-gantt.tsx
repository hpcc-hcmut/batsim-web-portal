import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Rect, Line, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import { Box, IconButton, Paper, Stack, Tooltip as MuiTooltip, Typography } from "@mui/material";
import { Download } from "@mui/icons-material";
import { TimelineJob } from "../../services/api";
import { useTimelineCursor } from "../../utils/timeline-cursor-context";
import { exportKonvaStagePng } from "../../utils/export-chart-png";

interface Props {
  jobs: TimelineJob[];
  nHosts: number;
  makespan: number;
  width?: number;
  height?: number;
  tStart?: number;
  tEnd?: number;
  // Host-axis window — defaults to [0, nHosts]. ReplayView's host slider drives this.
  hostStart?: number;
  hostEnd?: number;
  density?: boolean;
}

const PADDING = { top: 8, right: 16, bottom: 28, left: 56 };
const STATE_COLORS = {
  failed: "#c62828",
  timeout: "#ef6c00",
  unknown: "#9e9e9e",
};
// Distinct palette for successful jobs — color by job_id so researcher can
// visually track individual jobs across hosts.
const JOB_PALETTE = [
  "#4a9eff", "#51cf66", "#ffd43b", "#ff6b6b", "#cc5de8",
  "#20c997", "#ff922b", "#845ef7", "#339af0", "#f06595",
];
const TIME_AXIS_TICKS = 6;
const HOST_LABEL_EVERY = 8;

interface Bar {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  // Metadata for tooltip (P4)
  jobId: string;
  host: number;
  startTime: number;
  finishTime: number;
  waitingTime: number | null;
  success: boolean;
}

interface TooltipData {
  bar: Bar;
  mouseX: number;
  mouseY: number;
}

function jobColor(j: TimelineJob): string {
  if (!j.success) {
    return j.final_state?.includes("TIMEOUT") ? STATE_COLORS.timeout
      : j.final_state ? STATE_COLORS.failed
      : STATE_COLORS.unknown;
  }
  const idNum = parseInt(j.job_id.split("!")[1] || j.job_id, 10) || 0;
  return JOB_PALETTE[Math.abs(idNum) % JOB_PALETTE.length];
}

export function ScheduleGantt({
  jobs,
  nHosts,
  makespan,
  width = 800,
  height = 360,
  tStart,
  tEnd,
  hostStart,
  hostEnd,
  density = false,
}: Props) {
  const cursor = useTimelineCursor();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null); // PNG export handle
  const [measuredW, setMeasuredW] = useState(width);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setMeasuredW(Math.max(320, Math.floor(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = measuredW;
  const H = height;
  const plotW = Math.max(50, W - PADDING.left - PADDING.right);
  const plotH = Math.max(50, H - PADDING.top - PADDING.bottom);

  const t0 = tStart ?? 0;
  const t1 = tEnd ?? makespan ?? 0;
  const tSpan = Math.max(1e-9, t1 - t0);
  const xScale = plotW / tSpan;

  // Host-axis window (P1)
  const h0 = hostStart ?? 0;
  const h1 = hostEnd ?? nHosts;
  const visibleHosts = Math.max(1, h1 - h0);
  const yScale = plotH / visibleHosts;

  const bars = useMemo<Bar[]>(() => {
    const out: Bar[] = [];
    for (const j of jobs) {
      if (j.starting_time == null || j.finish_time == null) continue;
      const startT = Math.max(t0, j.starting_time);
      const endT = Math.min(t1, j.finish_time);
      if (endT <= startT) continue;
      const x = PADDING.left + (startT - t0) * xScale;
      const w = Math.max(1, (endT - startT) * xScale);
      const color = jobColor(j);
      const hosts = j.allocated_resources.length
        ? j.allocated_resources
        : Array.from({ length: j.requested_resources }, (_, i) => i);
      for (const h of hosts) {
        if (h < h0 || h >= h1) continue;
        out.push({
          key: `${j.job_id}-${h}`,
          x,
          y: PADDING.top + (h - h0) * yScale,
          w,
          h: Math.max(1, yScale - 1),
          color,
          jobId: j.job_id,
          host: h,
          startTime: j.starting_time!,
          finishTime: j.finish_time!,
          waitingTime: j.waiting_time ?? null,
          success: j.success,
        });
      }
    }
    return out;
  }, [jobs, xScale, yScale, h0, h1, t0, t1]);

  const timeTicks = useMemo(() => {
    const ticks: Array<{ x: number; label: string }> = [];
    for (let i = 0; i <= TIME_AXIS_TICKS; i += 1) {
      const t = t0 + (i / TIME_AXIS_TICKS) * tSpan;
      ticks.push({
        x: PADDING.left + (t - t0) * xScale,
        label: t.toFixed(t < 100 ? 1 : 0),
      });
    }
    return ticks;
  }, [t0, tSpan, xScale]);

  const hostTicks = useMemo(() => {
    const ticks: Array<{ y: number; label: string }> = [];
    if (visibleHosts <= 0) return ticks;
    const step = visibleHosts <= 32 ? 1 : Math.ceil(visibleHosts / HOST_LABEL_EVERY);
    for (let i = 0; i < visibleHosts; i += step) {
      ticks.push({ y: PADDING.top + i * yScale, label: String(h0 + i) });
    }
    return ticks;
  }, [visibleHosts, yScale, h0]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    const x = pos.x - PADDING.left;
    if (x < 0 || x > plotW || xScale <= 0) {
      cursor.setT(null);
      return;
    }
    cursor.setT(t0 + x / xScale);
  }, [cursor, plotW, xScale, t0]);

  // Tooltip handlers (P4) — sparse mode only
  const handleBarEnter = useCallback((bar: Bar, e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) setTooltip({ bar, mouseX: pos.x, mouseY: pos.y });
  }, []);

  const handleBarLeave = useCallback(() => setTooltip(null), []);

  const drawBarsScene = useMemo(() => {
    return (ctx: Konva.Context) => {
      const byColor = new Map<string, Bar[]>();
      for (const b of bars) {
        const list = byColor.get(b.color);
        if (list) list.push(b);
        else byColor.set(b.color, [b]);
      }
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (const [color, group] of byColor.entries()) {
        ctx.fillStyle = color;
        for (const b of group) {
          ctx.fillRect(b.x, b.y, b.w, b.h);
        }
      }
      ctx.restore();
    };
  }, [bars]);

  return (
    <Box ref={wrapRef} sx={{ width: "100%", position: "relative" }}>
      <Stack direction="row" spacing={2} sx={{ mb: 0.5, alignItems: "baseline" }}>
        <Typography variant="caption" color="text.secondary">
          {bars.length} bars · hosts {h0}–{h1 - 1} of {nHosts} · window {t0.toFixed(1)}s–{t1.toFixed(1)}s
          {density ? " (density)" : ""}
        </Typography>
        {cursor.t != null && <Typography variant="caption">t = {cursor.t.toFixed(2)}s</Typography>}
        <Box sx={{ flex: 1 }} />
        <MuiTooltip title="Download Gantt as PNG">
          <IconButton
            size="small"
            onClick={() => stageRef.current && exportKonvaStagePng(stageRef.current, "gantt")}
          >
            <Download fontSize="inherit" />
          </IconButton>
        </MuiTooltip>
      </Stack>
      <Stage
        ref={stageRef}
        width={W}
        height={H}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { cursor.setT(null); setTooltip(null); }}
      >
        <Layer listening={false}>
          <Rect x={PADDING.left} y={PADDING.top} width={plotW} height={plotH} fill="#fafafa" stroke="#e0e0e0" />
          {hostTicks.map((t) => (
            <Line key={`hg-${t.label}`} points={[PADDING.left, t.y, PADDING.left + plotW, t.y]} stroke="#eeeeee" />
          ))}
          {hostTicks.map((t) => (
            <Text key={`hl-${t.label}`} x={4} y={t.y - 6} text={`h${t.label}`} fontSize={10} fill="#666" />
          ))}
          {timeTicks.map((t, i) => (
            <Line key={`tg-${i}`} points={[t.x, PADDING.top, t.x, PADDING.top + plotH]} stroke="#eeeeee" />
          ))}
          {timeTicks.map((t, i) => (
            <Text key={`tl-${i}`} x={t.x - 12} y={PADDING.top + plotH + 4} text={t.label} fontSize={10} fill="#666" />
          ))}
        </Layer>

        {density ? (
          <Layer listening={false}>
            <Rect x={0} y={0} width={W} height={H} sceneFunc={(ctx) => drawBarsScene(ctx)} />
          </Layer>
        ) : (
          <Layer>
            {bars.map((b) => (
              <Rect
                key={b.key}
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill={b.color}
                opacity={0.85}
                onMouseEnter={(e) => handleBarEnter(b, e)}
                onMouseLeave={handleBarLeave}
              />
            ))}
          </Layer>
        )}

        {cursor.t != null && cursor.t >= t0 && cursor.t <= t1 && (
          <Layer listening={false}>
            <Line
              points={[
                PADDING.left + (cursor.t - t0) * xScale, PADDING.top,
                PADDING.left + (cursor.t - t0) * xScale, PADDING.top + plotH,
              ]}
              stroke="#1976d2"
              strokeWidth={1}
              dash={[4, 4]}
            />
          </Layer>
        )}
      </Stage>

      {/* Tooltip overlay (P4) — positioned at mouse, shows job details */}
      {tooltip && !density && (
        <Paper
          elevation={4}
          sx={{
            position: "absolute",
            left: Math.min(tooltip.mouseX + 12, W - 260),
            top: tooltip.mouseY - 10,
            px: 1.5,
            py: 1,
            pointerEvents: "none",
            zIndex: 10,
            maxWidth: 280,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <Typography variant="caption" fontWeight={700} sx={{ display: "block" }}>
            {tooltip.bar.jobId}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Host {tooltip.bar.host} · {tooltip.bar.success ? "success" : "failed"}
          </Typography>
          <Typography variant="caption" sx={{ display: "block" }}>
            {tooltip.bar.startTime.toFixed(1)}s → {tooltip.bar.finishTime.toFixed(1)}s
            ({(tooltip.bar.finishTime - tooltip.bar.startTime).toFixed(1)}s)
          </Typography>
          {tooltip.bar.waitingTime != null && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              waited {tooltip.bar.waitingTime.toFixed(1)}s
            </Typography>
          )}
        </Paper>
      )}
    </Box>
  );
}
