/**
 * Host x Time utilization heatmap - the classic HPC schedule view.
 * Row = host, column = time bucket, brightness = busy fraction.
 *
 * Where a 50k-job Gantt turns to noise, this stays readable: idle holes,
 * load imbalance and the makespan tail pop out instantly.
 *
 * Rendering: the full grid is painted ONCE onto an offscreen canvas
 * (1px per cell), then the visible window is a cheap drawImage crop -
 * time/host slider sync costs ~0ms regardless of grid size.
 * Color ramp + axis gutters per 07/06 feedback (see heatmap-color-scale.ts).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, IconButton, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from "@mui/material";
import { Download } from "@mui/icons-material";
import { HeatmapResponse, resultsAPI } from "../../services/api";
import { exportCanvasPng } from "../../utils/export-chart-png";
import {
  HeatmapScheme, cellColor, legendGradient, schemeSwatch,
} from "./heatmap-color-scale";

const SCHEME_STORAGE_KEY = "heatmapScheme";

function loadScheme(): HeatmapScheme {
  return localStorage.getItem(SCHEME_STORAGE_KEY) === "red" ? "red" : "blue";
}

const GUTTER_LEFT = 44; // host labels column (matches Gantt's label budget)
const GUTTER_BOTTOM = 18; // time tick row

const TICK_STYLE: React.CSSProperties = {
  position: "absolute",
  fontSize: 10,
  color: "#9ca3af",
  whiteSpace: "nowrap",
};

function formatTime(t: number): string {
  return t >= 100 ? `${Math.round(t)}s` : `${t.toFixed(1)}s`;
}

/** Evenly spaced ticks across [lo, hi] - returns value + fractional position */
function makeTicks(lo: number, hi: number, count: number): Array<{ v: number; frac: number }> {
  if (hi <= lo) return [];
  const out: Array<{ v: number; frac: number }> = [];
  for (let i = 0; i < count; i++) {
    const frac = i / (count - 1);
    out.push({ v: lo + frac * (hi - lo), frac });
  }
  return out;
}

interface Props {
  resultId: number;
  /** Visible time window (same domain as the Replay range slider) */
  tStart: number;
  tEnd: number;
  /** Visible host window (same domain as the Replay host slider) */
  hostStart: number;
  hostEnd: number;
  height?: number;
}

export const HostUtilizationHeatmap: React.FC<Props> = ({
  resultId,
  tStart,
  tEnd,
  hostStart,
  hostEnd,
  height = 220,
}) => {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  // Color scheme: blue (dark UI) or red (paper-style, print-friendly exports)
  const [scheme, setScheme] = useState<HeatmapScheme>(loadScheme);
  const changeScheme = (s: HeatmapScheme | null) => {
    if (!s) return;
    setScheme(s);
    localStorage.setItem(SCHEME_STORAGE_KEY, s);
  };

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    resultsAPI
      .getHeatmap(resultId)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load heatmap data.");
      });
    return () => {
      cancelled = true;
    };
  }, [resultId]);

  // Paint the full grid once per dataset: 1 cell = 1 pixel
  const offscreen = useMemo(() => {
    if (!data || !data.rows.length) return null;
    const cv = document.createElement("canvas");
    cv.width = data.buckets;
    cv.height = data.n_hosts;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(data.buckets, data.n_hosts);
    for (let h = 0; h < data.n_hosts; h++) {
      const row = data.rows[h] || [];
      for (let b = 0; b < data.buckets; b++) {
        const [r, g, bl] = cellColor(row[b] ?? 0, scheme);
        const o = (h * data.buckets + b) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = bl;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }, [data, scheme]);

  // Crop the visible (time x host) window onto the on-screen canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !offscreen || !data) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const span = data.t1 - data.t0 || 1;
    const bw = span / data.buckets;
    const sx = Math.max(0, Math.floor((tStart - data.t0) / bw));
    const sw = Math.max(1, Math.min(data.buckets - sx, Math.ceil((tEnd - tStart) / bw)));
    const sy = Math.max(0, hostStart);
    const sh = Math.max(1, Math.min(data.n_hosts - sy, hostEnd - hostStart));
    ctx.imageSmoothingEnabled = false; // crisp cell edges, no blur
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }, [offscreen, data, tStart, tEnd, hostStart, hostEnd]);

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const t = tStart + fx * (tEnd - tStart);
    const host = Math.min(hostEnd - 1, hostStart + Math.floor(fy * (hostEnd - hostStart)));
    const span = data.t1 - data.t0 || 1;
    const b = Math.max(0, Math.min(data.buckets - 1, Math.floor(((t - data.t0) / span) * data.buckets)));
    const frac = data.rows[host]?.[b] ?? 0;
    setHover(`host ${host} · t=${t.toFixed(0)}s · busy ${(frac * 100).toFixed(0)}%`);
  };

  // Axis ticks for the visible window (recomputed on slider moves - cheap)
  const hostTicks = useMemo(() => {
    const span = hostEnd - hostStart;
    if (span <= 0) return [];
    const count = Math.min(8, Math.max(2, Math.floor(span / 8) + 2));
    return makeTicks(hostStart, hostEnd - 1, count).map(({ v, frac }) => ({
      label: `h${Math.round(v)}`,
      frac,
    }));
  }, [hostStart, hostEnd]);

  const timeTicks = useMemo(
    () => makeTicks(tStart, tEnd, 6).map(({ v, frac }) => ({ label: formatTime(v), frac })),
    [tStart, tEnd],
  );

  if (error) return <Alert severity="warning">{error}</Alert>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          Host utilization heatmap
        </Typography>
        {/* Gradient legend (gamma ramp, deepest color = fully busy) */}
        <Box sx={{ width: 80, height: 8, borderRadius: 1, background: legendGradient(scheme) }} />
        <Typography variant="caption" color="text.secondary">
          0% - 100% busy
        </Typography>
        {/* Scheme toggle: blue (dark UI) / red (paper-style) */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={scheme}
          onChange={(_, v) => changeScheme(v)}
          sx={{ ml: 0.5 }}
        >
          {(["blue", "red"] as HeatmapScheme[]).map((s) => (
            <ToggleButton key={s} value={s} sx={{ px: 0.75, py: 0.25 }} aria-label={`${s} scheme`}>
              <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: schemeSwatch(s) }} />
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
          {hover ?? ""}
        </Typography>
        <Tooltip title="Download heatmap as PNG">
          <IconButton
            size="small"
            onClick={() =>
              canvasRef.current && exportCanvasPng(canvasRef.current, "host-utilization-heatmap")
            }
          >
            <Download sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>
      {!data ? (
        <Skeleton variant="rectangular" height={height + GUTTER_BOTTOM} sx={{ borderRadius: 1 }} />
      ) : !data.rows.length ? (
        <Alert severity="info">No allocation data for a heatmap.</Alert>
      ) : (
        <Box sx={{ display: "flex" }}>
          {/* Left gutter: host row labels at proportional offsets */}
          <Box sx={{ width: GUTTER_LEFT, position: "relative", height }}>
            {hostTicks.map((t) => (
              <span
                key={t.label}
                style={{
                  ...TICK_STYLE,
                  right: 6,
                  top: `calc(${t.frac * 100}% - ${t.frac * 12}px)`,
                }}
              >
                {t.label}
              </span>
            ))}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <canvas
              ref={canvasRef}
              width={960}
              height={height}
              onMouseMove={handleMove}
              onMouseLeave={() => setHover(null)}
              style={{
                width: "100%",
                height,
                borderRadius: 4,
                border: "1px solid #2d3748",
                display: "block",
                cursor: "crosshair",
              }}
            />
            {/* Bottom gutter: time ticks for the visible window */}
            <Box sx={{ position: "relative", height: GUTTER_BOTTOM }}>
              {timeTicks.map((t, i) => (
                <span
                  key={i}
                  style={{
                    ...TICK_STYLE,
                    top: 2,
                    left: `calc(${t.frac * 100}% - ${t.frac * 36}px)`,
                  }}
                >
                  {t.label}
                </span>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default HostUtilizationHeatmap;
