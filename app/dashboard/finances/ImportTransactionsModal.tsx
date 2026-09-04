"use client";

import { Dropzone, formatFileSize } from "@/app/components/ui/Dropzone";
import { downloadCsv, normalizeHeaderKey, parseCsvFull, type ParsedCsv } from "@/lib/csv";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceDirection,
} from "@/lib/types/finance";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/shadcn/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/shadcn/select";
import { importFinanceTransactions, type CsvTransactionRow } from "./actions";

const PREVIEW_MAX = 10;

const TEMPLATE_HEADERS = ["date", "description", "amount", "direction", "category"];
const TEMPLATE_EXAMPLE_ROWS = [
  ["2026-01-15", "TDECU monthly dividend", "12.50", "income", "Interest"],
  ["2026-01-18", "Event supplies - Party City", "-84.23", "expense", "Event Supplies"],
];

type PreparedRow = CsvTransactionRow;

type PrepareResult = {
  rows: PreparedRow[];
  skipped: number;
  unmatchedCategories: number;
};

function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    name.endsWith(".csv")
  );
}

/** Accepts ISO (2026-01-15) and US (1/15/2026 or 01/15/26) formats. */
function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    const d = new Date(`${trimmed.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(trimmed);
  if (us) {
    const [, mm, dd, yy] = us;
    const year = yy!.length === 2 ? `20${yy}` : yy!;
    const iso2 = `${year}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
    const d = new Date(`${iso2}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

/** Strips currency symbols/commas, keeps a leading minus sign. Returns dollars (not cents). */
function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeDirection(raw: string): FinanceDirection | null {
  const v = raw.trim().toLowerCase();
  if (v === "income" || v === "credit" || v === "deposit") return "income";
  if (v === "expense" || v === "debit" || v === "withdrawal") return "expense";
  return null;
}

function prepareRows(
  parsed: ParsedCsv,
  categories: FinanceCategory[]
): PrepareResult & { error: string | null } {
  const headerKeys = parsed.headers.map(normalizeHeaderKey);
  const idx = (names: string[]) => {
    const wanted = new Set(names.map(normalizeHeaderKey));
    return headerKeys.findIndex((k) => wanted.has(k));
  };

  const iDate = idx(["date", "occurred_at", "transaction_date"]);
  const iAmount = idx(["amount", "amount_usd"]);
  if (iDate === -1 || iAmount === -1) {
    return {
      rows: [],
      skipped: 0,
      unmatchedCategories: 0,
      error: "CSV must include columns for date and amount.",
    };
  }

  const iDescription = idx(["description", "memo", "note"]);
  const iDirection = idx(["direction", "type"]);
  const iCategory = idx(["category"]);

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const categoryLookup = new Map(
    categories.map((c) => [`${c.type}:${c.name.toLowerCase()}`, c.id])
  );

  let skipped = 0;
  let unmatchedCategories = 0;

  const rows: PreparedRow[] = [];
  for (const r of parsed.rows) {
    const occurred_at = parseDate(get(r, iDate));
    const dollars = parseAmount(get(r, iAmount));
    if (!occurred_at || dollars === null || dollars === 0) {
      skipped++;
      continue;
    }

    const explicitDirection = iDirection >= 0 ? normalizeDirection(get(r, iDirection)) : null;
    const direction: FinanceDirection = explicitDirection ?? (dollars < 0 ? "expense" : "income");
    const amount_cents = Math.round(Math.abs(dollars) * 100);

    const categoryRaw = get(r, iCategory);
    let category_id: string | null = null;
    if (categoryRaw) {
      const match = categoryLookup.get(`${direction}:${categoryRaw.toLowerCase()}`);
      if (match) category_id = match;
      else unmatchedCategories++;
    }

    rows.push({
      occurred_at,
      description: get(r, iDescription) || null,
      amount_cents,
      direction,
      category_id,
    });
  }

  return { rows, skipped, unmatchedCategories, error: null };
}

type Props = {
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  onClose: () => void;
  onImported: () => void | Promise<void>;
};

export function ImportTransactionsModal({ accounts, categories, onClose, onImported }: Props) {
  const [accountId, setAccountId] = useState(
    accounts.find((a) => a.type === "tdecu_manual")?.id ?? accounts[0]?.id ?? ""
  );
  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvSizeLabel, setCsvSizeLabel] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  const onFile = useCallback((file: File | null) => {
    setCsvName(file?.name ?? null);
    setCsvSizeLabel(file ? formatFileSize(file.size) : null);
    setCsvText(null);
    setParseError(null);
    setMessage(null);
    if (!file) return;
    if (!isCsvFile(file)) {
      setParseError("Please upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.onerror = () => setParseError("Could not read the file.");
    reader.readAsText(file);
  }, []);

  const prepared = useMemo(() => {
    if (!csvText) return null;
    const parsed = parseCsvFull(csvText);
    if (parsed.parseError) return { rows: [], skipped: 0, unmatchedCategories: 0, error: parsed.parseError };
    return prepareRows(parsed, categories);
  }, [csvText, categories]);

  const handleDownloadTemplate = useCallback(() => {
    downloadCsv([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE_ROWS], "transactions-import-template.csv");
  }, []);

  const handleImport = useCallback(async () => {
    if (!prepared || prepared.error) return;
    if (!accountId) {
      setMessage({ type: "error", text: "Choose an account to import into." });
      return;
    }
    if (!prepared.rows.length) {
      setMessage({ type: "error", text: "No valid rows found." });
      return;
    }

    setBusy(true);
    setMessage(null);
    const res = await importFinanceTransactions(accountId, prepared.rows);
    setBusy(false);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }

    setMessage({ type: "ok", text: `Imported ${res.inserted} transaction(s) as unverified.` });
    await onImported();
  }, [prepared, accountId, onImported]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-transactions-title"
      onClick={onClose}
      onKeyDown={(ev) => {
        if (ev.key === "Escape") onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="import-transactions-title" className="text-lg font-semibold text-card-foreground">
          Import transactions from CSV
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Required columns: <code className="text-xs">date</code> and{" "}
          <code className="text-xs">amount</code> (negative amounts are treated as
          expenses unless a <code className="text-xs">direction</code> column says
          otherwise). Optional: <code className="text-xs">description</code>,{" "}
          <code className="text-xs">direction</code> (income/expense or
          credit/debit), <code className="text-xs">category</code> (matched by
          name; left uncategorized if it doesn&apos;t match one you&apos;ve
          created). All rows land as unverified manual entries against the
          account you pick below - nothing is deduplicated against re-imports,
          so only upload a given file once.
        </p>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="mt-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-muted"
        >
          Download CSV template
        </button>

        <div className="mt-4 flex flex-col gap-1">
          <label className="text-sm font-medium text-card-foreground">Import into account</label>
          <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
            <SelectTrigger>
              <SelectValue>{(v: string) => accounts.find((a) => a.id === v)?.name ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            id="transactions-csv"
            accept=".csv,text/csv"
            hint="CSV files only"
            disabled={busy}
            fileName={csvName}
            fileSizeLabel={csvSizeLabel}
            onFileSelected={onFile}
          />
        </div>

        {(parseError || prepared?.error) && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {parseError ?? prepared?.error}
          </p>
        )}

        {prepared && !prepared.error && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-card-foreground">
              Preview ({Math.min(PREVIEW_MAX, prepared.rows.length)} of {prepared.rows.length} valid
              row{prepared.rows.length === 1 ? "" : "s"})
              {prepared.skipped > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {prepared.skipped} row{prepared.skipped === 1 ? "" : "s"} skipped (missing/invalid
                  date or amount)
                </span>
              )}
              {prepared.unmatchedCategories > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {prepared.unmatchedCategories} categor
                  {prepared.unmatchedCategories === 1 ? "y" : "ies"} didn&apos;t match, left
                  uncategorized
                </span>
              )}
            </p>
            <div className="max-h-52 overflow-auto rounded-lg border border-border">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Date</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Description</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Direction</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Amount</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {prepared.rows.slice(0, PREVIEW_MAX).map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">{r.occurred_at.slice(0, 10)}</td>
                      <td className="max-w-[12rem] truncate px-2 py-1.5">{r.description ?? "—"}</td>
                      <td className="px-2 py-1.5 capitalize">{r.direction}</td>
                      <td className="px-2 py-1.5">${(r.amount_cents / 100).toFixed(2)}</td>
                      <td className="px-2 py-1.5">
                        {r.category_id ? categories.find((c) => c.id === r.category_id)?.name : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            onClick={handleImport}
            disabled={busy || !prepared || !!prepared.error || !prepared.rows.length}
          >
            {busy ? "Importing…" : "Import"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
