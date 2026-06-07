/**
 * Color scales for the host-utilization heatmap. Both keep the same
 * intuition: the busier the cell, the DEEPER the color (07/06 feedback -
 * an earlier near-white "100% highlight" inverted that and was removed).
 *
 * blue: dark slate -> deep portal blue. Matches the dark UI.
 * red:  near-white -> deep red. Classic print/paper heatmap - also the
 *       better choice when exporting PNGs for reports.
 *
 * Gamma > 1 stretches the high end so 75% / 90% / 100% stay distinguishable
 * on saturated workloads (the "all one color" complaint).
 */

export type HeatmapScheme = "blue" | "red";

interface Rgb { r: number; g: number; b: number }

const SCHEMES: Record<HeatmapScheme, { low: Rgb; high: Rgb }> = {
  blue: {
    low: { r: 17, g: 24, b: 39 },     // dark slate (idle)
    high: { r: 74, g: 158, b: 255 },  // portal blue (fully busy)
  },
  red: {
    low: { r: 254, g: 247, b: 245 },  // warm near-white (idle)
    high: { r: 153, g: 27, b: 27 },   // deep red (fully busy)
  },
};

const GAMMA = 1.6;

export function cellColor(frac: number, scheme: HeatmapScheme): [number, number, number] {
  const { low, high } = SCHEMES[scheme];
  const f = Math.max(0, Math.min(1, frac));
  const g = Math.pow(f, GAMMA);
  return [
    Math.round(low.r + (high.r - low.r) * g),
    Math.round(low.g + (high.g - low.g) * g),
    Math.round(low.b + (high.b - low.b) * g),
  ];
}

/** CSS gradient matching the gamma ramp (sampled stops). */
export function legendGradient(scheme: HeatmapScheme): string {
  const stops: string[] = [];
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    const [r, g, b] = cellColor(f, scheme);
    stops.push(`rgb(${r},${g},${b}) ${f * 100}%`);
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/** Swatch color representing a scheme on the toggle button. */
export function schemeSwatch(scheme: HeatmapScheme): string {
  const [r, g, b] = cellColor(0.85, scheme);
  return `rgb(${r},${g},${b})`;
}
