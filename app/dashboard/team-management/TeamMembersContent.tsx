"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addTeamMember,
  getTeamMembersForManage,
  importTeamMembersCsv,
  removeTeamMember,
  searchUsersForTeamRoster,
  type TeamMemberRow,
  type TeamRosterCsvRow,
} from "./actions";

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

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as string[][], parseError: "The file is empty." };
  }
  try {
    const headers = parseCsvLine(lines[0] ?? "");
    const rows = lines.slice(1).map(parseCsvLine);
    return { headers, rows, parseError: null as string | null };
  } catch {
    return {
      headers: [] as string[],
      rows: [] as string[][],
      parseError:
        "Could not read this CSV. Use UTF-8, comma-separated, with a header row.",
    };
  }
}

function csvEscapeCell(val: string) {
  if (/[,"\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

function downloadCsv(rows: string[][], filename: string) {
  const text = rows.map((r) => r.map(csvEscapeCell).join(",")).join("\r\n");
  const bom = "\ufeff";
  const blob = new Blob([bom + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  initialMembers: TeamMemberRow[];
  teams: { id: string; name: string }[];
  loadErrorMembers: string | null;
  canManage: boolean;
};

export function TeamMembersContent({
  initialMembers,
  teams,
  loadErrorMembers,
  canManage,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialMembers);
  const [teamFilterId, setTeamFilterId] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [matches, setMatches] = useState<
    { id: string; email: string; first_name: string; last_name: string; discord: string }[]
  >([]);
  const [searching, setSearching] = useState(false);

  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvDragging, setCsvDragging] = useState(false);

  useEffect(() => {
    setRows(initialMembers);
  }, [initialMembers]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(userQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  useEffect(() => {
    if (!canManage || debouncedQ.length < 2) {
      setMatches([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setSearching(true);
      const { data, error } = await searchUsersForTeamRoster(debouncedQ);
      if (cancelled) return;
      setSearching(false);
      setMatches(error ? [] : data);
      if (error) setMessage({ type: "error", text: error });
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, canManage]);

  const refresh = useCallback(async () => {
    const res = await getTeamMembersForManage();
    if (!res.error) setRows(res.data);
    router.refresh();
  }, [router]);

  const filtered = useMemo(() => {
    if (!teamFilterId) return rows;
    return rows.filter((r) => r.team_id === teamFilterId);
  }, [rows, teamFilterId]);

  const selectedTeamLabel = useMemo(() => {
    if (!teamFilterId) return null;
    return teams.find((t) => t.id === teamFilterId)?.name ?? "team";
  }, [teams, teamFilterId]);

  const handleExportRoster = useCallback(() => {
    if (!teamFilterId || filtered.length === 0) return;
    const teamNameSafe = selectedTeamLabel?.replace(/[^\w.-]+/g, "_").slice(0, 48) ?? "team";
    const csvRows = [
      ["email", "first_name", "last_name", "discord"],
      ...filtered.map((m) => {
        const bits = (m.display_name ?? "").trim().split(/\s+/).filter(Boolean);
        const ln = bits.length >= 2 ? bits[bits.length - 1]! : "";
        const fn = bits.length >= 2 ? bits.slice(0, -1).join(" ") : (bits[0] ?? "");
        return [m.email || "", fn, ln, (m.discord ?? "").trim()];
      }),
    ];
    downloadCsv(csvRows, `team-roster-${teamNameSafe}.csv`);
  }, [filtered, teamFilterId, selectedTeamLabel]);

  const handleTemplate = useCallback(() => {
    if (!teamFilterId) return;
    const lab = selectedTeamLabel?.replace(/[^\w.-]+/g, "_").slice(0, 48) ?? "team";
    downloadCsv(
      [
        ["email", "first_name", "last_name", "discord"],
        ["student@chapter.edu", "Ada", "Lovelace", "ada_discord_handle"],
      ],
      `roster-import-template-${lab}.csv`
    );
  }, [teamFilterId, selectedTeamLabel]);

  const parseAndImportCsv = useCallback(async () => {
    if (!teamFilterId || !csvText) return;
    setMessage(null);
    const parsed = parseCsv(csvText);
    if (parsed.parseError || !parsed.headers.length) {
      setMessage({ type: "error", text: parsed.parseError ?? "Invalid CSV." });
      return;
    }

    const headerKeys = parsed.headers.map(normalizeHeaderKey);
    const findCol = (aliases: string[]) => {
      const want = new Set(aliases.map(normalizeHeaderKey));
      return headerKeys.findIndex((k) => want.has(k));
    };

    const iEmail = findCol(["email", "cougarnet_email", "personal_email"]);
    const iFirst = findCol(["first_name", "firstname", "first"]);
    const iLast = findCol(["last_name", "lastname", "last"]);
    const iDiscord = findCol(["discord", "discord_id", "discord_handle", "discord_username"]);

    if (
      iEmail < 0 &&
      iDiscord < 0 &&
      (iFirst < 0 || iLast < 0)
    ) {
      setMessage({
        type: "error",
        text:
          "CSV needs at least one of: email, discord (or discord_id / discord_handle), or both first_name and last_name (see template).",
      });
      return;
    }

    const payload: TeamRosterCsvRow[] = parsed.rows.map((cells) => {
      const ge = iEmail >= 0 ? (cells[iEmail] ?? "").trim() : "";
      const fn = iFirst >= 0 ? (cells[iFirst] ?? "").trim() : "";
      const ln = iLast >= 0 ? (cells[iLast] ?? "").trim() : "";
      const disc = iDiscord >= 0 ? (cells[iDiscord] ?? "").trim() : "";
      return {
        email: ge || null,
        first_name: fn || null,
        last_name: ln || null,
        discord: disc || null,
      };
    });

    const nonEmpty = payload.filter(
      (r) => r.email || (r.first_name && r.last_name) || (r.discord?.trim())
    );
    if (nonEmpty.length === 0) {
      setMessage({ type: "error", text: "No data rows found under the headers." });
      return;
    }

    setCsvBusy(true);
    const res = await importTeamMembersCsv(teamFilterId, nonEmpty);
    setCsvBusy(false);

    if (!res.ok) {
      setMessage({ type: "error", text: res.error });
      return;
    }

    setMessage({
      type: "ok",
      text: `Imported ${res.added} roster row(s). No matching user for ${res.not_found} row(s). ${res.failed_assignment} row(s) could not be assigned (database conflict or constraint).`,
    });
    setCsvName(null);
    setCsvText(null);
    await refresh();
  }, [csvText, refresh, teamFilterId]);

  const onCsvFile = useCallback((file: File | null) => {
    setCsvName(file?.name ?? null);
    setCsvText(null);
    setMessage(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage({ type: "error", text: "Please upload a .csv file." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  }, []);

  const addOne = async (user_id: string) => {
    if (!teamFilterId) {
      setMessage({ type: "error", text: "Select a team above before adding someone." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await addTeamMember(teamFilterId, user_id);
    setBusy(false);
    if (error) setMessage({ type: "error", text: error });
    else {
      setMessage({ type: "ok", text: "Member added to roster." });
      setUserQuery("");
      setMatches([]);
      await refresh();
    }
  };

  const removeOne = async (team_id: string, user_id: string) => {
    if (!confirm("Remove this member from the team roster?")) return;
    setBusy(true);
    setMessage(null);
    const { error } = await removeTeamMember(team_id, user_id);
    setBusy(false);
    if (error) setMessage({ type: "error", text: error });
    else await refresh();
  };

  return (
    <div className="space-y-6">
      {loadErrorMembers ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {loadErrorMembers}
        </div>
      ) : null}
      {message && (
        <div
          className={
            message.type === "error"
              ? "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
              : "rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
          }
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="text-sm font-medium text-muted-foreground">
          Focus team
        </label>
        <select
          value={teamFilterId}
          onChange={(e) => setTeamFilterId(e.target.value)}
          className="max-w-md rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="">All teams ({rows.length} assignments)</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {canManage ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">CSV roster import</h2>
          <p className="text-sm text-muted-foreground">
            Pick a single team under <strong>Focus team</strong>, then export a roster template or
            current roster CSV.             Rows match chapter members via email first, then Discord id/handle (<code className="rounded bg-muted px-1">
              users.discord
            </code>
            ), then exact first + last name. Each roster spot is
            unique per member — importing assigns them to {selectedTeamLabel ?? "the selected team"}{" "}
            even if they were on another team before.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!teamFilterId}
              onClick={handleTemplate}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-40"
            >
              Download CSV template
            </button>
            <button
              type="button"
              disabled={!teamFilterId || filtered.length === 0}
              onClick={handleExportRoster}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-40"
            >
              Download roster CSV
            </button>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Upload CSV to import roster
            </label>
            <div className="flex w-full items-center justify-center">
              <label
                htmlFor="team-roster-csv"
                onDragOver={(e) => {
                  e.preventDefault();
                  if (csvBusy || !teamFilterId) return;
                  setCsvDragging(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (csvBusy || !teamFilterId) return;
                  setCsvDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  const rt = e.relatedTarget as Node | null;
                  if (!rt || !e.currentTarget.contains(rt)) setCsvDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (csvBusy || !teamFilterId) return;
                  setCsvDragging(false);
                  onCsvFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`flex h-36 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition ${
                  csvBusy || !teamFilterId
                    ? "cursor-not-allowed border-border bg-muted/30 opacity-60"
                    : csvDragging
                      ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/20"
                      : "border-border bg-card hover:bg-muted/40"
                }`}
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
                    <span className="font-semibold text-card-foreground">Click to upload</span>{" "}
                    or drag and drop
                  </p>
                  <p className="text-xs">CSV files only</p>
                </div>
                <input
                  id="team-roster-csv"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={csvBusy || !teamFilterId}
                  onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            </div>
            {csvName ? (
              <p className="mt-2 text-xs text-muted-foreground">Selected: {csvName}</p>
            ) : null}
            <button
              type="button"
              disabled={csvBusy || !csvText || !teamFilterId}
              onClick={() => parseAndImportCsv()}
              className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {csvBusy ? "Importing…" : "Import CSV"}
            </button>
          </div>
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">Add member</h2>
          <p className="text-sm text-muted-foreground">
            Select a team in <strong>Focus team</strong>, then search for a user who is not already on
            a roster.
          </p>
          <input
            type="search"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Search by name, email, or Discord…"
            className="w-full max-w-lg rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            disabled={busy}
          />
          {searching && userQuery.trim().length >= 2 ? (
            <p className="text-xs text-muted-foreground">Searching…</p>
          ) : null}
          {userQuery.trim().length >= 2 && matches.length > 0 ? (
            <ul className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/20 py-1 text-sm">
              {matches.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}{" "}
                    <span className="text-muted-foreground">({u.email})</span>
                    {(u.discord ?? "").trim() ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Discord: {u.discord}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    disabled={busy || !teamFilterId}
                    onClick={() => addOne(u.id)}
                    className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    Add to team
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {userQuery.trim().length >= 2 && !searching && matches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No users match, or everyone is on a team.</p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">Roster assignments</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtered.length} row{filtered.length !== 1 ? "s" : ""}
            {teamFilterId ? ` for ${teams.find((t) => t.id === teamFilterId)?.name ?? "team"}` : ""}.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Team
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Member
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Email
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Discord
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Updated
                </th>
                {canManage ? (
                  <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 6 : 5}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    {rows.length === 0
                      ? "No roster assignments yet."
                      : "No rows for this filter."}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={`${m.team_id}-${m.user_id}`} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                      {m.team_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {m.display_name}
                    </td>
                    <td className="max-w-56 truncate px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {m.email || "—"}
                    </td>
                    <td className="max-w-52 font-mono text-xs px-4 py-3 text-muted-foreground sm:px-6">
                      {(m.discord ?? "").trim() || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {m.updated_at ? new Date(m.updated_at).toLocaleDateString() : "—"}
                    </td>
                    {canManage ? (
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm sm:px-6">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeOne(m.team_id, m.user_id)}
                          className="font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
