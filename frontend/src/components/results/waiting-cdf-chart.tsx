import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Box, Paper, Typography } from "@mui/material";
import { TimelineSeriesPoint } from "../../services/api";

interface Props {
  series: TimelineSeriesPoint[];
  height?: number;
}

/**
 * CDF of waiting times — x = wait time (s), y = fraction of jobs ≤ x.
 *
 * Axis is independent from the time-domain panels (x is "how long waited" not
 * "simulation time"), so this chart stays full-width regardless of the
 * Gantt time-window slider. Researcher uses it for fairness inspection:
 * how heavy is the tail of late jobs.
 */
export function WaitingCdfChart({ series, height = 140 }: Props) {
  const data = useMemo(
    () => ({
      datasets: [
        {
          label: "Waiting CDF",
          data: series.map((p) => ({ x: p.t, y: p.value })),
          borderColor: "#2e7d32",
          backgroundColor: "#2e7d3233",
          borderWidth: 1.5,
          stepped: "after" as const,
          fill: true,
          pointRadius: 0,
        },
      ],
    }),
    [series],
  );

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      animation: false,
      maintainAspectRatio: false,
      responsive: true,
      parsing: false,
      scales: {
        x: {
          type: "linear" as const,
          ticks: {
            maxTicksLimit: 6,
            font: { size: 10 },
            callback: (val: number | string) =>
              typeof val === "number" ? `${val.toFixed(val < 100 ? 1 : 0)}s` : val,
          },
          grid: { color: "#eeeeee" },
        },
        y: {
          min: 0,
          max: 1,
          ticks: {
            font: { size: 10 },
            callback: (val: number | string) =>
              typeof val === "number" ? `${(val * 100).toFixed(0)}%` : val,
          },
          grid: { color: "#eeeeee" },
        },
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Waiting CDF (% jobs ≤ wait)",
          font: { size: 11, weight: "bold" as const },
          align: "start" as const,
          padding: { bottom: 4 },
        },
        tooltip: {
          enabled: true,
          intersect: false,
          mode: "nearest" as const,
          callbacks: {
            label: (ctx: TooltipItem<"line">) => {
              const x = ctx.parsed.x ?? 0;
              const y = ctx.parsed.y ?? 0;
              return `≤ ${x.toFixed(1)}s → ${(y * 100).toFixed(1)}%`;
            },
          },
        },
      },
    }),
    [],
  );

  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Box sx={{ height }}>
        {series.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>
            No waiting time data available.
          </Typography>
        ) : (
          <Line data={data} options={options} />
        )}
      </Box>
    </Paper>
  );
}
