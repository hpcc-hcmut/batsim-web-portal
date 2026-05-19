// Inline-SVG sparkline — no external deps (Task 7.5 / locked D3)
import React from "react";

export interface SparklineProps {
  data: Array<[number, number]>; // (x, y) tuples
  width?: number; // default 120
  height?: number; // default 28
  color?: string; // default theme primary
  ariaLabel?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 120,
  height = 28,
  color = "#4a9eff",
  ariaLabel = "sparkline",
}) => {
  // Not enough data — render empty placeholder
  if (!data || data.length < 2) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label={ariaLabel} />;
  }

  const xs = data.map((p) => p[0]);
  const ys = data.map((p) => p[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = 0;
  const yMax = Math.max(1, ...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  // 1px padding on all sides so polyline sits inside viewport
  const pad = 1;

  const points = data
    .map(([x, y]) => {
      const px = ((x - xMin) / xRange) * (width - pad * 2) + pad;
      // SVG y-axis is inverted: top=0, so flip
      const py = height - pad - ((y - yMin) / yRange) * (height - pad * 2);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={ariaLabel}
      role="img"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
    </svg>
  );
};
