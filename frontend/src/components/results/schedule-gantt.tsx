import { useMemo, useRef, useEffect, useState } from "react";
import { Stage, Layer, Rect, Line, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import { Box, Stack, Typography } from "@mui/material";
import { TimelineJob } from "../../services/api";
import { useTimelineCursor } from "../../utils/timeline-cursor-context";

interface Props {
  jobs: TimelineJob[];
  nHosts: number;
  makespan: number;
  width?: number;
  height?: number;
  // Time-axis window — defaults to [0, makespan]. ReplayView's slider drives this.
  tStart?: number;
  tEnd?: number;
  // Density mode: draw all bars via a single Layer.sceneFunc call instead of N React
  // <Rect> components. Bypasses React-Konva reconciliation cost when bar count is
  // large (>~2000) — at the price of losing per-bar event listeners.
  density?: boolean;
}

// Visual tuning knobs — kept inline (not config) since they only affect this component.
const PADDING = { top: 8, right: 16, bottom: 28, left: 56 };
const STATE_COLORS = {
  success: "#2e7d32",
  failed: "#c62828",
  timeout: "#ef6c00",
  unknown: "#9e9e9e",
};
const TIME_AXIS_TICKS = 6;
const HOST_LABEL_EVERY = 8; // skip labels when n_hosts is large to avoid clutter

interface Bar {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/**
 * Gantt with two render paths:
 *
 *   1. Sparse path (default): each bar is a React `<Rect>` — clean event model, good
 *      for ≤ ~2000 bars where reconciliation is cheap.
 *   2. Density path (`density={true}` or auto when bar count blows past the cap):
 *      a single Layer with a custom sceneFunc that draws all rects in one
 *      `ctx.fillRect()` loop. No per-bar React nodes, no per-bar listeners — the
 *      Konva Stage still tracks mouse for cursor broadcast.
 *
 * Coordinate system (with active window [tStart, tEnd]):
 *   x = PADDING.left + (t - tStart) * xScale, where xScale = plotW / (tEnd - tStart)
 *   y = PADDING.top  + (hostIdx / nHosts) * plotH
 */
export function ScheduleGantt({
  jobs,
  nHosts,
  makespan,
  width = 800,
  height = 360,
  tStart,
  tEnd,
  density = false,
}: Props) {
  const cursor = useTimelineCursor();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [measuredW, setMeasuredW] = useState(width);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.max(320, Math.floor(entry.contentRect.width));
      setMeasuredW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = measuredW;
  const H = height;
  const plotW = Math.max(50, W - PADDING.left - PADDING.right);
  const plotH = Math.max(50, H - PADDING.top - PADDING.bottom);

  // Effective time window — fall back to [0, makespan] when slider hasn't supplied bounds.
  const t0 = tStart ?? 0;
  const t1 = tEnd ?? makespan ?? 0;
  const tSpan = Math.max(1e-9, t1 - t0);
  const xScale = plotW / tSpan;
  const yScale = nHosts > 0 ? plotH / nHosts : 0;

  // Flatten jobs → bars (one per allocated host). Clipped to the visible window so the
  // sceneFunc doesn't waste pixels drawing offscreen rects.
  const bars = useMemo<Bar[]>(() => {
    const out: Bar[] = [];
    for (const j of jobs) {
      if (j.starting_time == null || j.finish_time == null) continue;
      const startT = Math.max(t0, j.starting_time);
      const endT = Math.min(t1, j.finish_time);
      if (endT <= startT) continue; // outside window
      const x = PADDING.left + (startT - t0) * xScale;
      const w = Math.max(1, (endT - startT) * xScale);
      const color = j.success
        ? STATE_COLORS.success
        : j.final_state?.includes("TIMEOUT")
          ? STATE_COLORS.timeout
          : j.final_state
            ? STATE_COLORS.failed
            : STATE_COLORS.unknown;
      const hosts = j.allocated_resources.length
        ? j.allocated_resources
        : Array.from({ length: j.requested_resources }, (_, i) => i);
      for (const h of hosts) {
        if (h < 0 || h >= nHosts) continue;
        out.push({
          key: `${j.job_id}-${h}`,
          x,
          y: PADDING.top + h * yScale,
          w,
          h: Math.max(1, yScale - 1),
          color,
        });
      }
    }
    return out;
  }, [jobs, xScale, yScale, nHosts, t0, t1]);

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
    if (nHosts <= 0) return ticks;
    const step = nHosts <= 32 ? 1 : Math.ceil(nHosts / HOST_LABEL_EVERY);
    for (let i = 0; i < nHosts; i += step) {
      ticks.push({ y: PADDING.top + i * yScale, label: String(i) });
    }
    return ticks;
  }, [nHosts, yScale]);

  // Broadcast hover time so the line charts can highlight the same instant.
  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    const x = pos.x - PADDING.left;
    if (x < 0 || x > plotW || xScale <= 0) {
      cursor.setT(null);
      return;
    }
    cursor.setT(t0 + x / xScale);
  };

  // Density-mode sceneFunc — draws ALL bars in one fillRect loop, grouped by color
  // to minimise context-state churn. React renders ONE node (the Layer); the actual
  // pixels come from this hand-rolled paint pass.
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
    <Box ref={wrapRef} sx={{ width: "100%" }}>
      <Stack direction="row" spacing={2} sx={{ mb: 0.5, alignItems: "baseline" }}>
        <Typography variant="caption" color="text.secondary">
          {bars.length} bar-segments · {nHosts} hosts · window {t0.toFixed(1)}s –{" "}
          {t1.toFixed(1)}s {density ? "(density)" : ""}
        </Typography>
        {cursor.t != null && <Typography variant="caption">t = {cursor.t.toFixed(2)}s</Typography>}
      </Stack>
      <Stage
        width={W}
        height={H}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => cursor.setT(null)}
      >
        <Layer listening={false}>
          {/* plot background */}
          <Rect
            x={PADDING.left}
            y={PADDING.top}
            width={plotW}
            height={plotH}
            fill="#fafafa"
            stroke="#e0e0e0"
          />
          {/* host gridlines */}
          {hostTicks.map((t) => (
            <Line
              key={`hg-${t.label}`}
              points={[PADDING.left, t.y, PADDING.left + plotW, t.y]}
              stroke="#eeeeee"
            />
          ))}
          {hostTicks.map((t) => (
            <Text
              key={`hl-${t.label}`}
              x={4}
              y={t.y - 6}
              text={`h${t.label}`}
              fontSize={10}
              fill="#666"
            />
          ))}
          {/* time-axis ticks */}
          {timeTicks.map((t, i) => (
            <Line
              key={`tg-${i}`}
              points={[t.x, PADDING.top, t.x, PADDING.top + plotH]}
              stroke="#eeeeee"
            />
          ))}
          {timeTicks.map((t, i) => (
            <Text
              key={`tl-${i}`}
              x={t.x - 12}
              y={PADDING.top + plotH + 4}
              text={t.label}
              fontSize={10}
              fill="#666"
            />
          ))}
        </Layer>

        {/* Bars — sparse path for low counts, sceneFunc density path otherwise */}
        {density ? (
          <Layer listening={false}>
            <Rect
              x={0}
              y={0}
              width={W}
              height={H}
              sceneFunc={(ctx) => drawBarsScene(ctx)}
            />
          </Layer>
        ) : (
          <Layer listening={false}>
            {bars.map((b) => (
              <Rect key={b.key} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.color} opacity={0.85} />
            ))}
          </Layer>
        )}

        {/* cursor */}
        {cursor.t != null && cursor.t >= t0 && cursor.t <= t1 && (
          <Layer listening={false}>
            <Line
              points={[
                PADDING.left + (cursor.t - t0) * xScale,
                PADDING.top,
                PADDING.left + (cursor.t - t0) * xScale,
                PADDING.top + plotH,
              ]}
              stroke="#1976d2"
              strokeWidth={1}
              dash={[4, 4]}
            />
          </Layer>
        )}
      </Stage>
    </Box>
  );
}
