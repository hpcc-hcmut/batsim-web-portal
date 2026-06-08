/**
 * Live "Running for Xm Ys" label for a running experiment.
 * Ticks every second from start_time; renders nothing without a start_time.
 */
import React, { useEffect, useState } from "react";
import { Typography } from "@mui/material";

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface Props {
  startTime?: string;
  /** Tick only while true (running); freezes at last value otherwise */
  active: boolean;
}

export const ElapsedTicker: React.FC<Props> = ({ startTime, active }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!startTime || !active) return null;
  // Backend stores UTC but omits the 'Z' suffix → new Date() would parse it as
  // local time (GMT+N offset, e.g. "Running for 7h" in GMT+7). Append 'Z' when
  // no timezone designator is present so it parses as UTC.
  const normalized = /[Z+]/.test(startTime) || /[+-]\d{2}:\d{2}$/.test(startTime) ? startTime : startTime + "Z";
  const start = new Date(normalized).getTime();
  if (Number.isNaN(start)) return null;

  return (
    <Typography variant="caption" color="warning.main" sx={{ fontVariantNumeric: "tabular-nums" }}>
      Running for {formatElapsed(now - start)}
    </Typography>
  );
};
