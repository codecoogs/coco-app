/** Shared CSV export/import helpers (extracted from duplicated copies in team-management/events/opportunities). */

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
  parseError: string | null;
};

/**
 * Full-text CSV parser (not line-by-line) - fields routinely contain
 * embedded newlines inside quotes, which a naive split-then-parse-each-line
 * approach would corrupt.
 */
export function parseCsvFull(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) {
    return { headers: [], rows: [], parseError: "The file is empty." };
  }
  const headers = rows[0]!.map((h) => h.trim());
  const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== ""));
  return { headers, rows: dataRows, parseError: null };
}

export function normalizeHeaderKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export function csvEscapeCell(val: string) {
  if (/[,"\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

export function downloadCsv(rows: string[][], filename: string) {
  const text = rows.map((r) => r.map(csvEscapeCell).join(",")).join("\r\n");
  const bom = "﻿";
  const blob = new Blob([bom + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
