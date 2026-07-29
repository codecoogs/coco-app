"use client";

import { Dropzone, formatFileSize } from "@/app/components/ui/Dropzone";
import type { CsvOpportunityRow, EmploymentType } from "@/lib/types/opportunities";
import { EMPLOYMENT_TYPES } from "@/lib/types/opportunities";
import { useCallback, useState } from "react";
import { importOpportunitiesCsv } from "../actions";

const PREVIEW_MAX = 10;

type ParsedCsv = {
  headers: string[];
  rows: string[][];
  parseError: string | null;
};

/**
 * Full-text CSV parser (not line-by-line) — job description fields routinely contain
 * embedded newlines inside quotes, which a naive split-then-parse-each-line approach
 * (used elsewhere in this app for simpler CSVs) would corrupt.
 */
function parseCsvFull(text: string): ParsedCsv {
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

function normalizeHeaderKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function normalizeEmploymentType(raw: string): EmploymentType | null {
  const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, "-");
  const match = EMPLOYMENT_TYPES.find((t) => t.toLowerCase() === cleaned);
  return match ?? null;
}

function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    name.endsWith(".csv")
  );
}

type Props = {
  onClose: () => void;
  onImported: () => void | Promise<void>;
};

export function ImportOpportunitiesModal({ onClose, onImported }: Props) {
  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvSizeLabel, setCsvSizeLabel] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<ParsedCsv | null>(null);
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(
    null
  );
  const [summary, setSummary] = useState<{ inserted: number; skipped: number } | null>(
    null
  );

  const onFile = useCallback((file: File | null) => {
    setCsvName(file?.name ?? null);
    setCsvSizeLabel(file ? formatFileSize(file.size) : null);
    setCsvText(null);
    setCsvPreview(null);
    setCsvTotalRows(0);
    setSummary(null);
    setMessage(null);
    if (!file) return;
    if (!isCsvFile(file)) {
      setCsvPreview({ headers: [], rows: [], parseError: "Please upload a .csv file." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      const parsed = parseCsvFull(text);
      setCsvTotalRows(parsed.rows.length);
      setCsvPreview({
        headers: parsed.headers,
        rows: parsed.rows.slice(0, PREVIEW_MAX),
        parseError: parsed.parseError,
      });
    };
    reader.onerror = () => {
      setCsvPreview({ headers: [], rows: [], parseError: "Could not read the file." });
    };
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(async () => {
    if (!csvText) return;
    setMessage(null);
    setSummary(null);

    const parsed = parseCsvFull(csvText);
    if (parsed.parseError) {
      setMessage({ type: "error", text: parsed.parseError });
      return;
    }

    const headerKeys = parsed.headers.map(normalizeHeaderKey);
    const idx = (names: string[]) => {
      const wanted = new Set(names.map(normalizeHeaderKey));
      return headerKeys.findIndex((k) => wanted.has(k));
    };

    const iId = idx(["linkedin_job_id", "external_id", "job_id"]);
    const iTitle = idx(["position", "title"]);
    const iCompany = idx(["company_name", "company"]);
    const iLink = idx(["application_url", "link_url", "link"]);
    if (iId === -1 || iTitle === -1 || iCompany === -1 || iLink === -1) {
      setMessage({
        type: "error",
        text:
          "CSV must include columns for a unique id (e.g. linkedin_job_id), position, company_name, and application_url.",
      });
      return;
    }

    const iLocation = idx(["location"]);
    const iEmploymentType = idx(["employment_type"]);
    const iSalary = idx(["salary"]);
    const iDescription = idx(["description"]);

    const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

    const rows: CsvOpportunityRow[] = parsed.rows
      .map((r) => {
        const external_id = get(r, iId);
        const title = get(r, iTitle);
        const company_name = get(r, iCompany);
        const link_url = get(r, iLink);
        if (!external_id || !title || !company_name || !link_url) return null;

        const rawEmploymentType = get(r, iEmploymentType);
        const rawDescription = get(r, iDescription);

        return {
          external_id,
          title,
          company_name,
          link_url,
          location: get(r, iLocation) || null,
          employment_type: rawEmploymentType
            ? normalizeEmploymentType(rawEmploymentType)
            : null,
          salary: get(r, iSalary) || null,
          description: rawDescription ? decodeHtmlEntities(rawDescription) : null,
        };
      })
      .filter((v): v is CsvOpportunityRow => v !== null);

    if (!rows.length) {
      setMessage({
        type: "error",
        text: "No valid rows found. Each row needs an id, position, company, and application link.",
      });
      return;
    }

    setBusy(true);
    const res = await importOpportunitiesCsv(rows);
    setBusy(false);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }

    setSummary({ inserted: res.inserted, skipped: res.skipped_duplicates });
    setMessage({
      type: "ok",
      text: `Imported ${res.inserted} posting(s) as inactive, pending review. Skipped ${res.skipped_duplicates} already-imported duplicate(s).`,
    });
    await onImported();
  }, [csvText, onImported]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-opportunities-title"
      onClick={onClose}
      onKeyDown={(ev) => {
        if (ev.key === "Escape") onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="import-opportunities-title"
          className="text-lg font-semibold text-card-foreground"
        >
          Import opportunities from CSV
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Required columns: <code className="text-xs">linkedin_job_id</code> (or any
          unique id), <code className="text-xs">position</code>,{" "}
          <code className="text-xs">company_name</code>,{" "}
          <code className="text-xs">application_url</code>. Optional:{" "}
          <code className="text-xs">location</code>,{" "}
          <code className="text-xs">employment_type</code>,{" "}
          <code className="text-xs">salary</code>,{" "}
          <code className="text-xs">description</code>. Imported rows land inactive for
          review — nothing goes live automatically.
        </p>

        {message && (
          <div
            className={
              message.type === "error"
                ? "mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                : "mt-3 rounded-lg border border-green-200 bg-green-50 p-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
            }
          >
            {message.text}
          </div>
        )}

        <div className="mt-4">
          <Dropzone
            id="opportunities-csv"
            accept=".csv,text/csv"
            hint="CSV files only"
            disabled={busy}
            fileName={csvName}
            fileSizeLabel={csvSizeLabel}
            onFileSelected={onFile}
          />
        </div>

        {csvPreview?.parseError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {csvPreview.parseError}
          </p>
        )}

        {csvPreview && !csvPreview.parseError && csvPreview.headers.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-card-foreground">
              Preview ({Math.min(PREVIEW_MAX, csvPreview.rows.length)} of {csvTotalRows}{" "}
              row{csvTotalRows === 1 ? "" : "s"})
            </p>
            <div className="max-h-52 overflow-auto rounded-lg border border-border">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {csvPreview.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {csvPreview.rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((cell, j) => (
                        <td key={j} className="max-w-[16rem] truncate px-2 py-1.5">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {summary && (
          <p className="mt-3 text-sm text-muted-foreground">
            {summary.inserted} imported · {summary.skipped} skipped (already imported)
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleImport}
            disabled={busy || !csvText}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy
              ? "Importing…"
              : message?.type === "error"
                ? "Retry import"
                : "Import"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
