import { useMemo, useRef, useEffect, useState } from "react";
import { Stage, Layer, Rect, Line, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Box, Stack, Typography } from "@mui/material";
import { TimelineJob } from "../../services/api";
import { useTimelineCursor } from "../../utils/timeline-cursor-context";

interface Props {
  jobs: TimelineJob[];
  nHosts: number;
  makespan: number;
  width?: number;
  height?: number;
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

/**
 * Gantt skeleton — renders job allocations as horizontal bars (one per allocated host)
 * on a canvas via react-konva. M2 keeps this intentionally minimal: bars + axes + cursor
 * broadcast on hover. M3 will add: tooltip on hover, click-to-highlight, time-range
 * slider zoom, density mode for >5k jobs.
 *
 * Coordinate system:
 *   x = PADDING.left + (t / makespan) * plotW   where plotW = width - L - R
 *   y = PADDING.top  + (hostIdx / nHosts) * plotH where plotH = height - T - B
 */
export function ScheduleGantt({
  jobs,
  nHosts,
  makespan,
  width = 800,
  height = 360,
}: Props) {
  const cursor = useTimelineCursor();
  // Track container width so the chart fills its parent on resize.
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
  const xScale = makespan > 0 ? plotW / makespan : 0;
  const yScale = nHosts > 0 ? plotH / nHosts : 0;

  // Compute job bars once per render — flatMap allocations to one rect each.
  const bars = useMemo(() => {
    const out: Array<{
      key: string;
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }> = [];
    for (const j of jobs) {
      if (j.starting_time == null || j.finish_time == null) continue;
      const startX = PADDING.left + j.starting_time * xScale;
      const w = Math.max(1, (j.finish_time - j.starting_time) * xScale);
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
          x: startX,
          y: PADDING.top + h * yScale,
          w,
          h: Math.max(1, yScale - 1),
          color,
        });
      }
    }
    return out;
  }, [jobs, xScale, yScale, nHosts]);

  // Time-axis ticks (evenly spaced labels along the bottom edge).
  const timeTicks = useMemo(() => {
    if (makespan <= 0) return [];
    const ticks: Array<{ x: number; label: string }> = [];
    for (let i = 0; i <= TIME_AXIS_TICKS; i += 1) {
      const t = (i / TIME_AXIS_TICKS) * makespan;
      ticks.push({
        x: PADDING.left + t * xScale,
        label: t.toFixed(t < 100 ? 1 : 0),
      });
    }
    return ticks;
  }, [makespan, xScale]);

  const hostTicks = useMemo(() => {
    const ticks: Array<{ y: number; label: string }> = [];
    if (nHosts <= 0) return ticks;
    const step = nHosts <= 32 ? 1 : Math.ceil(nHosts / HOST_LABEL_EVERY);
    for (let i = 0; i < nHosts; i += step) {
      ticks.push({
        y: PADDING.top + i * yScale,
        label: String(i),
      });
    }
    return ticks;
  }, [nHosts, yScale]);

  // Broadcast hover time so M3 line charts can highlight the same instant.
  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    const x = pos.x - PADDING.left;
    if (x < 0 || x > plotW || xScale <= 0) {
      cursor.setT(null);
      return;
    }
    cursor.setT(x / xScale);
  };

  return (
    <Box ref={wrapRef} sx={{ width: "100%" }}>
      <Stack direction="row" spacing={2} sx={{ mb: 0.5, alignItems: "baseline" }}>
        <Typography variant="caption" color="text.secondary">
          {jobs.length} bar-segments · {nHosts} hosts · makespan {makespan.toFixed(2)}s
        </Typography>
        {cursor.t != null && (
          <Typography variant="caption">t = {cursor.t.toFixed(2)}s</Typography>
        )}
      </Stack>
      <Stage width={W} height={H} onMouseMove={handleMouseMove} onMouseLeave={() => cursor.setT(null)}>
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
          {/* host labels (left) */}
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
          {timeTicks.map((t) => (
            <Line
              key={`tg-${t.label}`}
              points={[t.x, PADDING.top, t.x, PADDING.top + plotH]}
              stroke="#eeeeee"
            />
          ))}
          {timeTicks.map((t) => (
            <Text
              key={`tl-${t.label}`}
              x={t.x - 12}
              y={PADDING.top + plotH + 4}
              text={t.label}
              fontSize={10}
              fill="#666"
            />
          ))}
        </Layer>
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
            />
          ))}
        </Layer>
        {cursor.t != null && xScale > 0 && (
          <Layer listening={false}>
            <Line
              points={[
                PADDING.left + cursor.t * xScale,
                PADDING.top,
                PADDING.left + cursor.t * xScale,
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
