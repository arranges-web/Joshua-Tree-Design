// Minimal CSV export helper. RFC 4180 quoting: fields containing
// commas, quotes, or newlines are wrapped in double quotes and any
// embedded double quotes are doubled. The browser download is a Blob
// with `text/csv` so spreadsheet apps recognize it.

function quoteField(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowsToCsv<T>(
  rows: ReadonlyArray<T>,
  columns: ReadonlyArray<{ header: string; value: (row: T) => unknown }>,
): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => quoteField(c.header)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => quoteField(c.value(row))).join(","));
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // Prepend BOM so Excel detects UTF-8 correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Slight delay so Safari finishes the download before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
