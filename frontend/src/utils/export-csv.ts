/**
 * Tiny CSV exporter — no extra dependency, RFC 4180 quoting, UTF-8 BOM for Excel.
 *
 * Used by ComparePage to ship comparison metrics straight to a `.csv` file the
 * researcher can drop into Excel / Python / R for further plotting. Kept dep-free
 * because the payload is small (≤10 experiments × ~15 metrics) — Papa Parse would
 * be over-engineering.
 */

export interface CsvColumn<T> {
  key: keyof T;
  header: string;
  // Optional formatter for non-trivial values (e.g. round, ISO date). Defaults to String().
  format?: (value: T[keyof T], row: T) => string | number | null | undefined;
}

const NEEDS_QUOTING = /[",\r\n]/;
// Excel + LibreOffice interpret cells whose first char is one of =,+,-,@ (or TAB / CR)
// as a formula. A malicious experiment name like `=HYPERLINK("http://evil","click")`
// would auto-execute on open. Prefix with a single quote to neutralize. Internal data
// here is low-risk but the cost of guarding is trivial — defense-in-depth.
const FORMULA_LEADERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = typeof value === "string" ? value : String(value);
  if (str.length > 0 && FORMULA_LEADERS.has(str[0])) {
    str = `'${str}`;
  }
  if (NEEDS_QUOTING.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) =>
    columns
      .map((col) => {
        const raw = col.format ? col.format(row[col.key], row) : row[col.key];
        return escapeCell(raw);
      })
      .join(","),
  );
  return [header, ...body].join("\r\n");
}

/**
 * Trigger a browser download of CSV. UTF-8 BOM prefix (﻿) makes Excel render
 * Vietnamese characters correctly when the file is double-clicked.
 */
export function downloadCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  const csv = rowsToCsv(rows, columns);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Defer revoke so Safari has time to start the download before the URL dies.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
