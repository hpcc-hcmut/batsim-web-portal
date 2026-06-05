/**
 * Per-page cards/list view preference, persisted in localStorage so each
 * page remembers its own mode across reloads (key: `viewMode:{pageKey}`).
 */
import { useCallback, useState } from "react";

export type ViewMode = "cards" | "list";

export function useViewMode(pageKey: string): [ViewMode, (m: ViewMode) => void] {
  const storageKey = `viewMode:${pageKey}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === "list" ? "list" : "cards";
    } catch {
      return "cards";
    }
  });

  const update = useCallback(
    (m: ViewMode) => {
      setMode(m);
      try {
        localStorage.setItem(storageKey, m);
      } catch {
        // storage unavailable (private mode) — keep in-memory state only
      }
    },
    [storageKey],
  );

  return [mode, update];
}
