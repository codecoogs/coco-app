/** Shared CSV export helpers (extracted from duplicated copies in team-management/events). */

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
