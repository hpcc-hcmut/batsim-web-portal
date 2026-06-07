/**
 * Chart -> PNG download helpers. Lab users drop these straight into reports,
 * so exports render at 2x for print sharpness.
 *
 * Works with both render stacks used in the app:
 *  - chart.js  -> chart.canvas (already a HTMLCanvasElement)
 *  - konva     -> stage.toDataURL({ pixelRatio })
 *  - raw <canvas> (heatmap) -> canvas.toDataURL()
 */

function sanitize(name: string): string {
  return name.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export function pngFilename(base: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${sanitize(base)}-${date}.png`;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Export an HTMLCanvasElement (chart.js `chart.canvas` or a raw canvas).
 * Dark UI background is baked in so the PNG looks like the app.
 */
export function exportCanvasPng(
  canvas: HTMLCanvasElement,
  baseName: string,
  background: string = "#1a202c",
): void {
  // Compose onto an opaque background: chart.js canvases are transparent
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  downloadDataUrl(out.toDataURL("image/png"), pngFilename(baseName));
}

/** Export a Konva stage (Gantt). pixelRatio 2 keeps text crisp in print. */
export function exportKonvaStagePng(
  stage: { toDataURL: (cfg: { pixelRatio: number }) => string },
  baseName: string,
): void {
  downloadDataUrl(stage.toDataURL({ pixelRatio: 2 }), pngFilename(baseName));
}
