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
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, IconButton, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import { Download } from "@mui/icons-material";
import { HeatmapResponse, resultsAPI } from "../../services/api";
import { exportCanvasPng } from "../../utils/export-chart-png";

// Single-hue scale: dark slate -> portal blue (no rainbow noise)
const LOW = { r: 17, g: 24, b: 39 };
const HIGH = { r: 74, g: 158, b: 255 };

function cellColor(frac: number): [number, number, number] {
  const f = Math.max(0, Math.min(1, frac));
  return [
    Math.round(LOW.r + (HIGH.r - LOW.r) * f),
    Math.round(LOW.g + (HIGH.g - LOW.g) * f),
    Math.round(LOW.b + (HIGH.b - LOW.b) * f),
  ];
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
        const [r, g, bl] = cellColor(row[b] ?? 0);
        const o = (h * data.buckets + b) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = bl;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }, [data]);

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

  if (error) return <Alert severity="warning">{error}</Alert>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          Host utilization heatmap
        </Typography>
        {/* Gradient legend */}
        <Box
          sx={{
            width: 80,
            height: 8,
            borderRadius: 1,
            background: `linear-gradient(to right, rgb(${LOW.r},${LOW.g},${LOW.b}), rgb(${HIGH.r},${HIGH.g},${HIGH.b}))`,
          }}
        />
        <Typography variant="caption" color="text.secondary">
          0% - 100% busy
        </Typography>
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
        <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 1 }} />
      ) : !data.rows.length ? (
        <Alert severity="info">No allocation data for a heatmap.</Alert>
      ) : (
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
      )}
    </Box>
  );
};

export default HostUtilizationHeatmap;
