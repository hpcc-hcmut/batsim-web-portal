// Utility: format an ISO date string as a human-readable relative time.
// Uses Intl.RelativeTimeFormat for locale-aware output.
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "-";
  // Backend (SQLite func.now()) stores UTC but omits the Z suffix in JSON.
  // Without Z, JS new Date() treats the string as LOCAL time, causing a
  // GMT+N offset (e.g. "7 hours ago" for a just-completed experiment in GMT+7).
  const normalized = /[Z+]/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z";
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return "-";
  const deltaSec = Math.round((date.getTime() - Date.now()) / 1000);
  const absSec = Math.abs(deltaSec);
  if (absSec < 60) return rtf.format(deltaSec, "second");
  const deltaMin = Math.round(deltaSec / 60);
  if (Math.abs(deltaMin) < 60) return rtf.format(deltaMin, "minute");
  const deltaHr = Math.round(deltaMin / 60);
  if (Math.abs(deltaHr) < 24) return rtf.format(deltaHr, "hour");
  const deltaDay = Math.round(deltaHr / 24);
  if (Math.abs(deltaDay) < 7) return rtf.format(deltaDay, "day");
  const deltaWeek = Math.round(deltaDay / 7);
  if (Math.abs(deltaWeek) < 5) return rtf.format(deltaWeek, "week");
  const deltaMon = Math.round(deltaDay / 30);
  if (Math.abs(deltaMon) < 12) return rtf.format(deltaMon, "month");
  const deltaYr = Math.round(deltaDay / 365);
  return rtf.format(deltaYr, "year");
}
