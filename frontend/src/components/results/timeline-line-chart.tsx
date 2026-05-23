import { useMemo, useRef, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";
import { Box, Paper, Typography } from "@mui/material";
import { TimelineSeriesPoint } from "../../services/api";
import { useTimelineCursor } from "../../utils/timeline-cursor-context";

// Register Chart.js modules once per app load. Re-registering is a no-op so this is safe.
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface Props {
  title: string;
  series: TimelineSeriesPoint[];
  color: string;
  // y-axis hints — let consumers force bounds (e.g. utilization in [0,1])
  yMin?: number;
  yMax?: number;
  yFormatter?: (value: number) => string;
  // x-axis range driven by ReplayView's time-window slider — chart stays in lockstep with Gantt
  tMin: number;
  tMax: number;
  height?: number;
}

/**
 * Step-line chart aligned to simulation time. Subscribes to TimelineCursorContext —
 * when the Gantt's mouse hover broadcasts a time `t`, we redraw a dashed vertical
 * marker at the same x so the researcher can read all panels at one instant.
 */
export function TimelineLineChart({
  title,
  series,
  color,
  yMin,
  yMax,
  yFormatter,
  tMin,
  tMax,
  height = 120,
}: Props) {
  const cursor = useTimelineCursor();
  // Chart.js + react-chartjs-2 union types for ref are fiddly; treat as opaque ChartJS
  // instance for our limited use (canvas + scales access).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  const chartData = useMemo(
    () => ({
      datasets: [
        {
          label: title,
          data: series.map((p) => ({ x: p.t, y: p.value })),
          borderColor: color,
          backgroundColor: `${color}33`,
          borderWidth: 1.5,
          stepped: "before" as const,  // event-driven series — step style is the honest viz
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 3,
        },
      ],
    }),
    [series, title, color],
  );

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      animation: false,
      maintainAspectRatio: false,
      responsive: true,
      parsing: false, // x/y already in {x, y} form — avoid Chart.js auto-parse cost
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
          min: yMin,
          max: yMax,
          ticks: {
            font: { size: 10 },
            callback: (val: number | string) =>
              typeof val === "number" && yFormatter ? yFormatter(val) : val,
          },
          grid: { color: "#eeeeee" },
        },
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: title,
          font: { size: 11, weight: "bold" as const },
          align: "start" as const,
          padding: { bottom: 4 },
        },
        tooltip: {
          enabled: true,
          intersect: false,
          mode: "nearest" as const,
        },
      },
    }),
    [tMin, tMax, yMin, yMax, title, yFormatter],
  );

  // Cursor sync — when t changes, draw a vertical line via Chart.js draw event.
  // Avoids a re-render loop by manipulating the canvas directly after the chart settles.
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

  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Box sx={{ height }}>
        {series.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>
            {title}: chưa có dữ liệu trong khoảng đã chọn.
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
