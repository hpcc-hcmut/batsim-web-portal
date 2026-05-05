import React from "react";

// Precompiled regexes for syntax tinting — kept here so log-stream-viewer.tsx stays under 200 LOC
const RE_ERROR = /\b(ERROR|FATAL|CRITICAL)\b/i;
const RE_WARN = /\b(WARN(?:ING)?)\b/i;

const GUTTER_STYLE: React.CSSProperties = {
  display: "inline-block",
  width: "3em",
  textAlign: "right",
  paddingRight: "0.75em",
  marginRight: "0.5em",
  color: "#6b7280",
  borderRight: "1px solid #374151",
  fontVariantNumeric: "tabular-nums",
  userSelect: "none",
  flexShrink: 0,
};

/**
 * Renders a single log line with:
 * - 4-char gutter with line number
 * - Red tint for ERROR/FATAL/CRITICAL
 * - Amber tint for WARN/WARNING
 * - <details> collapse for lines longer than 2000 chars
 */
export function renderLine(line: string, lineNo: number): React.ReactNode {
  const isLong = line.length > 2000;
  const isError = RE_ERROR.test(line);
  const isWarn = !isError && RE_WARN.test(line);
  const color = isError ? "#f87171" : isWarn ? "#fbbf24" : undefined;

  const lineContent = isLong ? (
    <details style={{ display: "inline", cursor: "pointer" }}>
      <summary style={{ color: "#9ca3af", fontSize: "0.7rem" }}>
        line {lineNo} · {line.length.toLocaleString()} chars · click to expand
      </summary>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{line}</pre>
    </details>
  ) : (
    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{line}</span>
  );

  return (
    <div
      key={lineNo}
      style={{
        display: "flex",
        alignItems: "flex-start",
        color: color,
        lineHeight: 1.5,
        minHeight: "1.5em",
      }}
    >
      <span style={GUTTER_STYLE}>{lineNo}</span>
      {lineContent}
    </div>
  );
}
