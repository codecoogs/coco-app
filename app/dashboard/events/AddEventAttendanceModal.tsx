"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useState } from "react";
import {
  importEventAttendanceCsv,
  recordEventAttendance,
  searchUsersForAttendance,
  type EventRow,
  type UserSearchResult,
} from "./actions";

type Tab = "member" | "csv";

const PREVIEW_MAX = 20;

function fireSideCannons() {
  const end = Date.now() + 3_000; // 3 seconds
  const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

  const frame = () => {
    if (Date.now() > end) return;

    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      startVelocity: 60,
      origin: { x: 0, y: 0.5 },
      colors,
    });
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      startVelocity: 60,
      origin: { x: 1, y: 0.5 },
      colors,
    });

    requestAnimationFrame(frame);
  };

  frame();
}

function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" || // common for CSV
    name.endsWith(".csv")
  );
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeaderKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

type ParsedCsv = {
  headers: string[];
  rows: string[][];
  parseError: string | null;
};

function parseCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], parseError: "The file is empty." };
  }
  try {
    const headers = parseCsvLine(lines[0]!);
    const rows = lines.slice(1).map(parseCsvLine);
    return { headers, rows, parseError: null };
  } catch {
    return {
      headers: [],
      rows: [],
      parseError:
        "Could not read this CSV. Try a comma-separated file with a header row.",
    };
  }
}

function parseCsvForPreview(text: string, maxDataRows: number): ParsedCsv {
  const full = parseCsv(text);
  if (full.parseError) return full;
  return {
    headers: full.headers,
    rows: full.rows.slice(0, maxDataRows),
    parseError: null,
  };
}

type Props = {
  event: EventRow;
  onClose: () => void;
  onRecorded: () => void | Promise<void>;
};

export function AddEventAttendanceModal({ event, onClose, onRecorded }: Props) {
  const [subTab, setSubTab] = useState<Tab>("member");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);

  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvImportBusy, setCsvImportBusy] = useState(false);
  const [csvDragActive, setCsvDragActive] = useState(false);
  const [csvSummary, setCsvSummary] = useState<{
    inserted_events_attendance: number;
    inserted_unassigned: number;
  } | null>(null);
  const [csvPreview, setCsvPreview] = useState<{
    headers: string[];
    rows: string[][];
    parseError: string | null;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (subTab !== "member" || debounced.length < 1) return;
    let cancelled = false;
    (async () => {
      setSearching(true);
      setSearchError(null);
      const { data, error } = await searchUsersForAttendance(debounced);
      if (cancelled) {
        return;
      }
      setSearching(false);
      if (error) {
        setSearchError(error);
        setResults([]);
        return;
      }
      setResults(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, subTab]);

  const resultsToShow = debounced.length < 1 ? [] : results;
  const showSearchError = debounced.length > 0 && searchError;
  const showSearching = debounced.length > 0 && searching;

  const addOne = useCallback(
    async (user: UserSearchResult) => {
      setBusyUserId(user.id);
      setFormMessage(null);
      const { error } = await recordEventAttendance(event.id, user.id);
      setBusyUserId(null);
      if (error) {
        setFormMessage({ type: "error", text: error });
        return;
      }
      setFormMessage({ type: "ok", text: "Attendance recorded." });
      await onRecorded();
    },
    [event.id, onRecorded],
  );

  const onFile = useCallback((file: File | null) => {
    setCsvName(file?.name ?? null);
    setCsvText(null);
    setCsvPreview(null);
    setCsvSummary(null);
    if (!file) return;
    if (!isCsvFile(file)) {
      setCsvPreview({
        headers: [],
        rows: [],
        parseError: "Please upload a .csv file.",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      setCsvPreview(parseCsvForPreview(text, PREVIEW_MAX));
    };
    reader.onerror = () => {
      setCsvText(null);
      setCsvPreview({
        headers: [],
        rows: [],
        parseError: "Could not read the file.",
      });
    };
    reader.readAsText(file);
  }, []);

  const onCsvDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setCsvDragActive(false);
      if (csvImportBusy) return;
      const file = e.dataTransfer.files?.[0] ?? null;
      onFile(file);
    },
    [csvImportBusy, onFile],
  );

  const importCsv = useCallback(async () => {
    if (!csvText) return;
    setFormMessage(null);
    setCsvSummary(null);

    const parsed = parseCsv(csvText);
    if (parsed.parseError) {
      setFormMessage({ type: "error", text: parsed.parseError });
      return;
    }
    if (!parsed.headers.length) {
      setFormMessage({ type: "error", text: "CSV is missing a header row." });
      return;
    }

    const headerKeys = parsed.headers.map(normalizeHeaderKey);
    const idx = (names: string[]) => {
      const wanted = new Set(names.map(normalizeHeaderKey));
      return headerKeys.findIndex((k) => wanted.has(k));
    };

    const iFirst = idx(["first_name", "firstname", "first"]);
    const iLast = idx(["last_name", "lastname", "last"]);
    if (iFirst === -1 || iLast === -1) {
      setFormMessage({
        type: "error",
        text:
          "CSV must include headers for first_name and last_name (case-insensitive; spaces/underscores allowed).",
      });
      return;
    }

    const iDiscord = idx(["discord", "discord_username", "discord_handle"]);
    const iPersonal = idx(["personal_email", "email", "personalemail"]);
    const iCoug = idx(["cougarnet_email", "cougarnet", "school_email"]);
    const iAttendedAt = idx(["attended_at", "attendedat", "timestamp"]);

    const rows = parsed.rows
      .map((r) => {
        const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
        const first_name = get(iFirst);
        const last_name = get(iLast);
        if (!first_name || !last_name) return null;
        const discord = get(iDiscord) || null;
        const personal_email = get(iPersonal) || null;
        const cougarnet_email = get(iCoug) || null;
        const attended_at = get(iAttendedAt) || null;
        return { first_name, last_name, discord, personal_email, cougarnet_email, attended_at };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));

    if (rows.length === 0) {
      setFormMessage({
        type: "error",
        text: "No valid rows found. Make sure first_name and last_name are filled.",
      });
      return;
    }

    setCsvImportBusy(true);
    const res = await importEventAttendanceCsv(event.id, rows);
    setCsvImportBusy(false);

    if (!res.ok) {
      setFormMessage({ type: "error", text: res.error });
      return;
    }

    setCsvSummary({
      inserted_events_attendance: res.inserted_events_attendance,
      inserted_unassigned: res.inserted_unassigned,
    });
    setFormMessage({
      type: "ok",
      text: `Imported ${res.inserted_events_attendance} check-in(s); stored ${res.inserted_unassigned} unassigned attendee(s).`,
    });
    fireSideCannons();
    await onRecorded();
  }, [csvText, event.id, onRecorded]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-attendance-title"
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
          id="add-attendance-title"
          className="text-lg font-semibold text-card-foreground"
        >
          Add attendance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-card-foreground">{event.title}</span>
          {event.start_time
            ? ` · ${new Date(event.start_time).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}`
            : null}
        </p>

        <div
          className="mt-4 inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === "member"}
            onClick={() => setSubTab("member")}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              subTab === "member"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Search members
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === "csv"}
            onClick={() => setSubTab("csv")}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              subTab === "csv"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upload CSV
          </button>
        </div>

        {formMessage && (
          <div
            className={
              formMessage.type === "error"
                ? "mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                : "mt-3 rounded-lg border border-green-200 bg-green-50 p-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
            }
          >
            {formMessage.text}
          </div>
        )}

        {subTab === "member" && (
          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="attendance-user-search"
                className="mb-1 block text-sm font-medium text-muted-foreground"
              >
                Search by email, name, or Discord
              </label>
              <input
                id="attendance-user-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
                placeholder="Email, name, or Discord handle"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              />
            </div>
            {showSearching && (
              <p className="text-sm text-muted-foreground">Searching…</p>
            )}
            {showSearchError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {searchError}
              </p>
            )}
            {!searching && debounced.length > 0 && !searchError && resultsToShow.length === 0 && (
              <p className="text-sm text-muted-foreground">No members match.</p>
            )}
            {resultsToShow.length > 0 && (
              <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {resultsToShow.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium text-card-foreground">
                        {u.first_name} {u.last_name}
                      </span>
                      <span className="ml-2 text-muted-foreground">{u.email}</span>
                      {u.discord?.trim() ? (
                        <span className="ml-2 text-muted-foreground">
                          {u.discord}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={busyUserId === u.id}
                      onClick={() => addOne(u)}
                      className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      {busyUserId === u.id ? "Saving…" : "Add check-in"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {subTab === "csv" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a UTF-8 CSV with a header row. Required columns:{" "}
              <code className="text-xs">first_name</code> and{" "}
              <code className="text-xs">last_name</code>. Optional:{" "}
              <code className="text-xs">discord</code>,{" "}
              <code className="text-xs">personal_email</code>,{" "}
              <code className="text-xs">cougarnet_email</code>,{" "}
              <code className="text-xs">attended_at</code>.
            </p>
            <div>
              <label
                htmlFor="attendance-csv"
                className="mb-1 block text-sm font-medium text-muted-foreground"
              >
                File
              </label>
              <div className="flex w-full items-center justify-center">
                <label
                  htmlFor="attendance-csv"
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!csvImportBusy) setCsvDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!csvImportBusy) setCsvDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCsvDragActive(false);
                  }}
                  onDrop={onCsvDrop}
                  className={`flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-4 transition ${
                    csvDragActive
                      ? "border-blue-500 bg-blue-500/5"
                      : "border-border bg-muted/30 hover:bg-muted/40"
                  } ${csvImportBusy ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <div className="flex flex-col items-center justify-center pt-2 pb-3 text-sm text-muted-foreground">
                    <svg
                      className="mb-3 h-8 w-8"
                      aria-hidden
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 17h3a3 3 0 0 0 0-6h-.025a5.56 5.56 0 0 0 .025-.5A5.5 5.5 0 0 0 7.207 9.021C7.137 9.017 7.071 9 7 9a4 4 0 1 0 0 8h2.167M12 19v-9m0 0-2 2m2-2 2 2"
                      />
                    </svg>
                    <p className="mb-1">
                      <span className="font-semibold text-card-foreground">
                        Click to upload
                      </span>{" "}
                      or drag and drop
                    </p>
                    <p className="text-xs">CSV files only</p>
                  </div>
                  <input
                    id="attendance-csv"
                    type="file"
                    accept=".csv,text/csv"
                    disabled={csvImportBusy}
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            {csvName && (
              <p className="text-xs text-muted-foreground">
                Selected: {csvName}
              </p>
            )}
            {csvPreview?.parseError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {csvPreview.parseError}
              </p>
            )}
            {csvPreview &&
              !csvPreview.parseError &&
              csvPreview.headers.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-card-foreground">
                    Preview (first {Math.min(PREVIEW_MAX, csvPreview.rows.length)}{" "}
                    data rows)
                  </p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Import destination: matched members →{" "}
                    <code>events_attendance</code>; unmatched attendees →{" "}
                    <code>unassigned_attendance</code>. This import will use{" "}
                    <code>event_id</code> = {event.id}.
                  </p>
                  <div className="max-h-64 overflow-auto rounded-lg border border-border">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="whitespace-nowrap px-2 py-2">#</th>
                          {csvPreview.headers.map((h) => (
                            <th
                              key={h}
                              className="whitespace-nowrap px-2 py-2 font-medium"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {csvPreview.rows.map((row, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {i + 1}
                            </td>
                            {row.map((cell, j) => (
                              <td key={j} className="px-2 py-1.5">
                                {cell || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={importCsv}
                      disabled={csvImportBusy || !csvText}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {csvImportBusy ? "Importing…" : "Import"}
                    </button>
                    {csvSummary && (
                      <p className="text-sm text-muted-foreground">
                        Imported{" "}
                        <span className="font-medium text-card-foreground">
                          {csvSummary.inserted_events_attendance}
                        </span>{" "}
                        check-in(s) · Stored{" "}
                        <span className="font-medium text-card-foreground">
                          {csvSummary.inserted_unassigned}
                        </span>{" "}
                        unassigned attendee(s)
                      </p>
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
