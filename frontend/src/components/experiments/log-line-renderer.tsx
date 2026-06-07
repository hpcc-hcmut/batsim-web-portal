import React from "react";
import { tokenizeLine } from "./log-line-tokenizer";

// Precompiled regexes for whole-line tinting (base color under token colors)
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

const CONTENT_STYLE: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

/**
 * Renders a single log line with:
 * - 4-char gutter with line number
 * - Token-level tinting (timestamp dim, level colored, events purple,
 *   job ids teal) — see log-line-tokenizer.ts; disable via `tokenize=false`
 *   for very large logs
 * - Red/amber whole-line base tint for ERROR / WARNING lines
 * - <details> collapse for lines longer than 2000 chars (never tokenized)
 */
export function renderLine(line: string, lineNo: number, tokenize = true): React.ReactNode {
  const isLong = line.length > 2000;
  const isError = RE_ERROR.test(line);
  const isWarn = !isError && RE_WARN.test(line);
  const baseColor = isError ? "#f87171" : isWarn ? "#fbbf24" : undefined;

  let lineContent: React.ReactNode;
  if (isLong) {
    lineContent = (
      <details style={{ display: "inline", cursor: "pointer" }}>
        <summary style={{ color: "#9ca3af", fontSize: "0.7rem" }}>
          line {lineNo} · {line.length.toLocaleString()} chars · click to expand
        </summary>
        <pre style={{ margin: 0, ...CONTENT_STYLE }}>{line}</pre>
      </details>
    );
  } else {
    const segments = tokenize ? tokenizeLine(line) : null;
    lineContent = segments ? (
      <span style={CONTENT_STYLE}>
        {segments.map((seg, i) =>
          seg.color || seg.fontWeight ? (
            <span key={i} style={{ color: seg.color, fontWeight: seg.fontWeight }}>
              {seg.text}
            </span>
          ) : (
            // Untinted segments inherit the line's base color (error/warn)
            <React.Fragment key={i}>{seg.text}</React.Fragment>
          ),
        )}
      </span>
    ) : (
      <span style={CONTENT_STYLE}>{line}</span>
    );
  }

  return (
    <div
      key={lineNo}
      style={{
        display: "flex",
        alignItems: "flex-start",
        color: baseColor,
        lineHeight: 1.5,
        minHeight: "1.5em",
      }}
    >
      <span style={GUTTER_STYLE}>{lineNo}</span>
      {lineContent}
    </div>
  );
}
