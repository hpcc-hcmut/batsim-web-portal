/**
 * Job-state composition over simulation time, stacked:
 *   green (bottom)  = completed so far (cumulative)
 *   blue  (middle)  = running now
 *   amber (top)     = waiting in queue
 * The envelope therefore equals "jobs submitted so far". A thick amber band is
 * the backlog story at a glance (FCFS piles it up, backfilling flattens it).
 *
 * Replaces the single queue-depth line: the amber layer IS queue depth, plus
 * two more layers of context on the same pixels.
 */
import { useEffect, useMemo, useRef } from "react";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { Box, Paper, Typography } from "@mui/material";
import { TimelineSeriesPoint } from "../../services/api";
import { useTimelineCursor } from "../../utils/timeline-cursor-context";
import { ChartExportButton } from "../common/chart-export-button";
import { exportCanvasPng } from "../../utils/export-chart-png";

const LAYERS = [
  { key: "completed", label: "Completed", color: "#2e7d32" },
  { key: "running", label: "Running", color: "#1976d2" },
  { key: "waiting", label: "Waiting", color: "#ef6c00" },
] as const;

interface Props {
  waiting: TimelineSeriesPoint[];
  running: TimelineSeriesPoint[];
  completed: TimelineSeriesPoint[];
  tMin: number;
  tMax: number;
  height?: number;
}

export function JobStateStackedArea({
  waiting,
  running,
  completed,
  tMin,
  tMax,
  height = 150,
}: Props) {
  const cursor = useTimelineCursor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  const chartData = useMemo(() => {
    const seriesOf = { completed, running, waiting };
    return {
      datasets: LAYERS.map((layer) => ({
        label: layer.label,
        data: seriesOf[layer.key].map((p) => ({ x: p.t, y: p.value })),
        borderColor: layer.color,
        backgroundColor: `${layer.color}59`, // ~35% alpha fill
        borderWidth: 1,
        stepped: "before" as const,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 3,
      })),
    };
  }, [waiting, running, completed]);

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      animation: false,
      maintainAspectRatio: false,
      responsive: true,
      parsing: false,
      scales: {
        x: {
          type: "linear" as const,
          min: tMin,
          max: tMax,
          ticks: {
            maxTicksLimit: 6,
            font: { size: 10 },
            callback: (val: number | string) =>
              typeof val === "number" ? `${val.toFixed(val < 100 ? 1 : 0)}s` : val,
          },
          grid: { color: "#eeeeee" },
        },
        y: {
          stacked: true,
          min: 0,
          ticks: { font: { size: 10 } },
          grid: { color: "#eeeeee" },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          align: "end" as const,
          labels: { boxWidth: 10, font: { size: 10 } },
        },
        title: {
          display: true,
          text: "Job states over time (stacked)",
          font: { size: 11, weight: "bold" as const },
          align: "start" as const,
          padding: { bottom: 4 },
        },
        tooltip: { enabled: true, intersect: false, mode: "index" as const },
      },
    }),
    [tMin, tMax],
  );

  // Cursor sync with the Gantt hover (same approach as TimelineLineChart)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.update("none");
    const t = cursor.t;
    if (t == null || t < tMin || t > tMax) return;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    if (!xScale || !yScale) return;
    const x = xScale.getPixelForValue(t);
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = "#1976d2";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, yScale.top);
    ctx.lineTo(x, yScale.bottom);
    ctx.stroke();
    ctx.restore();
  }, [cursor.t, tMin, tMax]);

  const empty = !waiting.length && !running.length && !completed.length;

  return (
    <Paper variant="outlined" sx={{ p: 1, position: "relative" }}>
      {!empty && (
        <ChartExportButton
          top={2}
          right={28}
          onExport={() =>
            chartRef.current && exportCanvasPng(chartRef.current.canvas, "job-states-stacked")
          }
        />
      )}
      <Box sx={{ height }}>
        {empty ? (
          <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>
            Job states: no data in selected range.
          </Typography>
        ) : (
          <Line
            ref={(instance) => {
              chartRef.current = instance;
            }}
            data={chartData}
            options={options}
          />
        )}
      </Box>
    </Paper>
  );
}
