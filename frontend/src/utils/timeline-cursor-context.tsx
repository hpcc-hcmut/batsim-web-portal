import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

/**
 * Shared time-cursor state for the Replay tab.
 *
 * Gantt broadcasts hover-time → Utilization + Queue line charts read it via context and
 * draw a vertical marker at the same x position. The CDF chart stays decoupled (its
 * x-axis is waiting time, not simulation time). Kept intentionally minimal in M2 — wire
 * the charts in M3.
 */
interface TimelineCursorState {
  t: number | null;
  setT: (next: number | null) => void;
  // M3 will add: lockedT (sticky after click), highlightedJobId, focusedHostIndex, ...
}

const TimelineCursorContext = createContext<TimelineCursorState | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export function TimelineCursorProvider({ children }: ProviderProps) {
  const [t, setTState] = useState<number | null>(null);

  const setT = useCallback((next: number | null) => {
    setTState(next);
  }, []);

  const value = useMemo<TimelineCursorState>(() => ({ t, setT }), [t, setT]);
  return (
    <TimelineCursorContext.Provider value={value}>{children}</TimelineCursorContext.Provider>
  );
}

/**
 * Read cursor state. Throws if used outside <TimelineCursorProvider> — surfaces forgotten
 * wiring instead of silently returning null and breaking sync.
 */
export function useTimelineCursor(): TimelineCursorState {
  const ctx = useContext(TimelineCursorContext);
  if (!ctx) {
    throw new Error(
      "useTimelineCursor must be used inside <TimelineCursorProvider> (Replay tab root).",
    );
  }
  return ctx;
}
