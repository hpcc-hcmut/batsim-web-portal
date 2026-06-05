/**
 * Generic compact table for the "list" view mode on entity pages.
 * Pages declare a columns config; this handles layout, hover, overflow.
 */
import React from "react";
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";

export interface ListColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: number | string;
  render: (row: T) => React.ReactNode;
}

interface Props<T> {
  columns: ListColumn<T>[];
  rows: T[];
  rowKey: (row: T) => React.Key;
  onRowClick?: (row: T) => void;
}

export function EntityListTable<T>({ columns, rows, rowKey, onRowClick }: Props<T>) {
  return (
    // TableContainer = horizontal scroll on narrow viewports (wide-table rule)
    <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: "transparent" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell
                key={c.key}
                align={c.align || "left"}
                sx={{ width: c.width, fontWeight: 700, whiteSpace: "nowrap" }}
              >
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              hover
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={onRowClick ? { cursor: "pointer" } : undefined}
            >
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  align={c.align || "left"}
                  sx={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {c.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
