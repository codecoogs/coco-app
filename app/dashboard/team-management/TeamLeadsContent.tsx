"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getTeamLeadsForManage,
  getUsersForLeadPicker,
  removeTeamLead,
  upsertTeamLead,
  type TeamLeadManageRow,
} from "./actions";

export type TeamOption = { id: string; name: string };

function filterUsers(
  users: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    discord?: string;
  }[],
  query: string,
  limit = 40
) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return users
    .filter((u) => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ").toLowerCase();
      const email = u.email.toLowerCase();
      const discord = (u.discord ?? "").toLowerCase();
      const hay = `${name} ${email} ${discord}`;
      return tokens.every((t) => hay.includes(t));
    })
    .slice(0, limit);
}

type Props = {
  initialLeads: TeamLeadManageRow[];
  teams: TeamOption[];
  loadErrorLeads: string | null;
  canManage: boolean;
};

export function TeamLeadsContent({
  initialLeads,
  teams,
  loadErrorLeads,
  canManage,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialLeads);
  const [adding, setAdding] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  const [usersPool, setUsersPool] = useState<
    { id: string; email: string; first_name: string; last_name: string; discord: string }[]
  >([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  useEffect(() => {
    setRows(initialLeads);
  }, [initialLeads]);

  const reload = useCallback(async () => {
    const res = await getTeamLeadsForManage();
    if (!res.error) setRows(res.data);
    router.refresh();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!canManage) return;
      if (!adding && !editingTeamId) return;
      const { data, error } = await getUsersForLeadPicker();
      if (!cancelled && !error) setUsersPool(data);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [canManage, adding, editingTeamId]);

  const pickerMatches = useMemo(
    () => filterUsers(usersPool, userSearch),
    [usersPool, userSearch]
  );

  const openAssign = () => {
    setMessage(null);
    setEditingTeamId(null);
    setUserSearch("");
    setSelectedUserId(null);
    setSelectedTeamId(teams[0]?.id ?? "");
    setAdding(true);
  };

  const openEdit = (lead: TeamLeadManageRow) => {
    setMessage(null);
    setAdding(false);
    setEditingTeamId(lead.team_id);
    setSelectedTeamId(lead.team_id);
    setSelectedUserId(lead.user_id);
    setUserSearch("");
    setUsersPool((prev) => {
      if (prev.some((u) => u.id === lead.user_id)) return prev;
      const nameParts = lead.display_name.split(/\s+/);
      return [
        ...prev,
        {
          id: lead.user_id,
          email: lead.email,
          first_name: nameParts[0] ?? "",
          last_name: nameParts.slice(1).join(" ") ?? "",
          discord: "",
        },
      ];
    });
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const tid = editingTeamId || selectedTeamId;
      const uid = selectedUserId;
      if (!tid || !uid) {
        setMessage({
          type: "error",
          text: tid ? "Pick a member as lead." : "Pick a team.",
        });
        return;
      }
      setBusy(true);
      setMessage(null);
      const { error } = await upsertTeamLead(tid, uid);
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setMessage({ type: "ok", text: "Team lead saved." });
      setAdding(false);
      setEditingTeamId(null);
      setUserSearch("");
      setSelectedUserId(null);
      await reload();
    },
    [editingTeamId, selectedTeamId, selectedUserId, reload]
  );

  const handleRemove = useCallback(
    async (team_id: string) => {
      if (!confirm("Remove this team lead?")) return;
      setBusy(true);
      setMessage(null);
      const { error } = await removeTeamLead(team_id);
      setBusy(false);
      if (error) setMessage({ type: "error", text: error });
      else setMessage({ type: "ok", text: "Lead removed." });
      await reload();
    },
    [reload]
  );

  const editingRow = editingTeamId ? rows.find((r) => r.team_id === editingTeamId) : null;

  return (
    <div className="space-y-4">
      {loadErrorLeads ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {loadErrorLeads}
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

      {canManage ? (
        <button
          type="button"
          onClick={() => openAssign()}
          disabled={teams.length === 0}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
        >
          Assign / change lead
        </button>
      ) : null}
      {canManage && teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">Create teams first under Teams.</p>
      ) : null}

      {(adding || editingTeamId) && canManage ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">
            {editingTeamId ? "Change team lead" : "Assign team lead"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each team has at most one lead (primary key is <code className="rounded bg-muted px-1">team_id</code>).
          </p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className={`${editingTeamId ? "pointer-events-none opacity-80" : ""}`}>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Team
              </label>
              {editingTeamId ? (
                <input
                  readOnly
                  value={
                    editingRow?.team_name ??
                    teams.find((t) => t.id === editingTeamId)?.name ??
                    ""
                  }
                  className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                />
              ) : (
                <select
                  required
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                >
                  <option value="" disabled>
                    Select team…
                  </option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Lead member
              </label>
              {selectedUserId ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-card-foreground">
                    {(() => {
                      const u = usersPool.find((x) => x.id === selectedUserId);
                      if (u) {
                        const nm = [u.first_name, u.last_name].filter(Boolean).join(" ");
                        return (
                          <>
                            <span className="font-medium">{nm || "—"}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{u.email}</span>
                            {(u.discord ?? "").trim() ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                Discord: {u.discord}
                              </span>
                            ) : null}
                          </>
                        );
                      }
                      if (editingRow && editingRow.user_id === selectedUserId) {
                        return (
                          <>
                            <span className="font-medium">{editingRow.display_name}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{editingRow.email}</span>
                          </>
                        );
                      }
                      return "—";
                    })()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(null)}
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    autoComplete="off"
                    placeholder="Search by name, email, or Discord…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                  />
                  {userSearch.trim() ? (
                    <ul className="mt-1 max-h-48 overflow-auto rounded-lg border border-border bg-card py-1 shadow-md">
                      {pickerMatches.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">No matches.</li>
                      ) : (
                        pickerMatches.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUserId(u.id);
                                setUserSearch("");
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            >
                              <span className="font-medium text-card-foreground">
                                {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">{u.email}</span>
                              {(u.discord ?? "").trim() ? (
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  Discord: {u.discord}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Pick a logged-in roster member ({usersPool.length} loaded).
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setEditingTeamId(null);
                  setSelectedUserId(null);
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">Team leads</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {rows.length} assignment{rows.length !== 1 ? "s" : ""} — one lead per team.
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
                  Lead
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Email
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
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 5 : 4}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No team leads assigned yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.team_id} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                      {row.team_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-card-foreground sm:px-6">
                      {row.display_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">{row.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {row.updated_at
                        ? new Date(row.updated_at).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    {canManage ? (
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm sm:px-6">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Change
                        </button>
                        <span className="text-muted-foreground"> · </span>
                        <button
                          type="button"
                          onClick={() => handleRemove(row.team_id)}
                          disabled={busy}
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
