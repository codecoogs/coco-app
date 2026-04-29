"use client";

import { useProfileOptional } from "@/app/contexts/ProfileContext";
import {
  createOfficer,
  deactivateOfficer,
  getPositionTitles,
  getUsersWithoutPosition,
  updateOfficer,
} from "./actions";
import type {
  BranchManageRow,
  BranchOption,
  OfficerRow,
  PositionManageRow,
  PositionTitleOption,
  RoleManageRow,
  RoleOption,
} from "./actions";
import { BranchesPanel } from "./BranchesPanel";
import { PositionsPanel } from "./PositionsPanel";
import { RolesPanel } from "./RolesPanel";
import { useCallback, useMemo, useState } from "react";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function displayName(row: OfficerRow): string {
  const first = row.user_first_name?.trim() ?? "";
  const last = row.user_last_name?.trim() ?? "";
  return [first, last].filter(Boolean).join(" ") || row.user_email || "—";
}

function userOptionLabel(u: {
  email: string;
  first_name: string;
  last_name: string;
  discord?: string;
}): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  let base = name ? `${name} (${u.email})` : u.email;
  const d = u.discord?.trim();
  if (d) base += ` · ${d}`;
  return base;
}

function filterUsersWithoutPosition(
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
  const scored = users.filter((u) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").toLowerCase();
    const email = u.email.toLowerCase();
    const discord = (u.discord ?? "").toLowerCase();
    const haystack = `${name} ${email} ${discord}`;
    return tokens.every((t) => haystack.includes(t));
  });
  return scored.slice(0, limit);
}

function filterPositionTitles(titles: PositionTitleOption[], query: string, limit = 40) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return titles
    .filter((p) => {
      const t = p.title.toLowerCase();
      return tokens.every((tok) => t.includes(tok));
    })
    .slice(0, limit);
}

type Props = {
  officers: OfficerRow[];
  canManage: boolean;
  positionsForManage?: PositionManageRow[];
  branchesForManage?: BranchManageRow[];
  branchOptions?: BranchOption[];
  roleOptions?: RoleOption[];
  rolesForManage?: RoleManageRow[];
  positionsLoadError?: string | null;
  branchesLoadError?: string | null;
  rolesLoadError?: string | null;
};

export function OfficersContent({
  officers: initialOfficers,
  canManage,
  positionsForManage = [],
  branchesForManage = [],
  branchOptions = [],
  roleOptions = [],
  rolesForManage = [],
  positionsLoadError = null,
  branchesLoadError = null,
  rolesLoadError = null,
}: Props) {
  const { refetchProfile } = useProfileOptional() ?? {};
  const [mainTab, setMainTab] = useState<
    "assignments" | "positions" | "branches" | "roles"
  >("assignments");
  const showAssignments = !canManage || mainTab === "assignments";
  const [officers, setOfficers] = useState(initialOfficers);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [positionTitles, setPositionTitles] = useState<PositionTitleOption[]>([]);
  const [usersWithoutPosition, setUsersWithoutPosition] = useState<
    { id: string; email: string; first_name: string; last_name: string; discord: string }[]
  >([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [positionSearchQuery, setPositionSearchQuery] = useState("");
  const [selectedPositionTitle, setSelectedPositionTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  const openAdd = useCallback(async () => {
    setUserSearchQuery("");
    setSelectedUserId(null);
    setPositionSearchQuery("");
    setSelectedPositionTitle(null);
    setAdding(true);
    setMessage(null);
    try {
      const [titlesRes, usersRes] = await Promise.all([
        getPositionTitles(),
        getUsersWithoutPosition(),
      ]);
      const errors = [titlesRes.error, usersRes.error].filter(Boolean) as string[];
      if (errors.length > 0) {
        setMessage({ type: "error", text: errors.join(" ") });
      }
      setPositionTitles(titlesRes.error ? [] : titlesRes.data);
      setUsersWithoutPosition(usersRes.error ? [] : usersRes.data);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Could not load form options.",
      });
      setPositionTitles([]);
      setUsersWithoutPosition([]);
    }
  }, []);

  const openEdit = useCallback(async (id: string) => {
    setEditingId(id);
    setMessage(null);
    const res = await getPositionTitles();
    if (res.error) setMessage({ type: "error", text: res.error });
    else setPositionTitles(res.data);
  }, []);

  const handleCreate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const user_id = selectedUserId;
      const positionTitle = selectedPositionTitle;
      if (!user_id || !positionTitle) {
        setMessage({
          type: "error",
          text: !user_id
            ? "Search and select a user."
            : "Search and select a position.",
        });
        return;
      }
      setBusy(true);
      setMessage(null);
      const { error } = await createOfficer(user_id, positionTitle);
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setMessage({ type: "ok", text: "Officer added." });
      setAdding(false);
      const { data } = await import("./actions").then((m) => m.getOfficers());
      setOfficers(data);
      await refetchProfile?.();
    },
    [refetchProfile, selectedUserId, selectedPositionTitle]
  );

  const handleUpdate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editingId) return;
      const form = e.currentTarget;
      const positionTitle = (form.elements.namedItem("positionTitle") as HTMLSelectElement).value;
      const is_active = (form.elements.namedItem("is_active") as HTMLInputElement).checked;
      setBusy(true);
      setMessage(null);
      const { error } = await updateOfficer(editingId, { positionTitle, is_active });
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setMessage({ type: "ok", text: "Updated." });
      setEditingId(null);
      const { data } = await import("./actions").then((m) => m.getOfficers());
      setOfficers(data);
      await refetchProfile?.();
    },
    [editingId, refetchProfile]
  );

  const handleDeactivate = useCallback(async (id: string) => {
    if (!confirm("Deactivate this officer assignment?")) return;
    setBusy(true);
    setMessage(null);
    const { error } = await deactivateOfficer(id);
    setBusy(false);
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }
    setMessage({ type: "ok", text: "Deactivated." });
    const { data } = await import("./actions").then((m) => m.getOfficers());
    setOfficers(data);
    await refetchProfile?.();
  }, [refetchProfile]);

  const editingRow = editingId ? officers.find((o) => o.id === editingId) : null;

  const selectedPickerUser = useMemo(
    () => usersWithoutPosition.find((u) => u.id === selectedUserId) ?? null,
    [usersWithoutPosition, selectedUserId]
  );

  const userSearchMatches = useMemo(
    () => filterUsersWithoutPosition(usersWithoutPosition, userSearchQuery),
    [usersWithoutPosition, userSearchQuery]
  );

  const positionSearchMatches = useMemo(
    () => filterPositionTitles(positionTitles, positionSearchQuery),
    [positionTitles, positionSearchQuery]
  );

  return (
    <div className="space-y-6">
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

      {canManage && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
            role="tablist"
            aria-label="Officers sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "assignments"}
              onClick={() => setMainTab("assignments")}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                mainTab === "assignments"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Position assignments
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "positions"}
              onClick={() => setMainTab("positions")}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                mainTab === "positions"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Positions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "branches"}
              onClick={() => setMainTab("branches")}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                mainTab === "branches"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Branches
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "roles"}
              onClick={() => setMainTab("roles")}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                mainTab === "roles"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Roles
            </button>
          </div>
          {mainTab === "assignments" && (
            <button
              type="button"
              onClick={openAdd}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
            >
              Add officer
            </button>
          )}
        </div>
      )}

      {canManage && mainTab === "positions" && (
        <PositionsPanel
          initialPositions={positionsForManage}
          branchOptions={branchOptions}
          roleOptions={roleOptions}
          loadError={positionsLoadError}
        />
      )}

      {canManage && mainTab === "branches" && (
        <BranchesPanel initialBranches={branchesForManage} loadError={branchesLoadError} />
      )}

      {canManage && mainTab === "roles" && (
        <RolesPanel initialRoles={rolesForManage} loadError={rolesLoadError} />
      )}

      {showAssignments && adding && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">Add officer</h2>
          <form
            onSubmit={handleCreate}
            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-x-4"
          >
            <label className="text-sm font-medium text-muted-foreground sm:col-start-1 sm:row-start-1">
              User
            </label>
            <label className="text-sm font-medium text-muted-foreground sm:col-start-2 sm:row-start-1">
              Position
            </label>
            <div
              className="hidden sm:col-start-3 sm:row-start-1 sm:block sm:text-sm sm:font-medium sm:text-transparent sm:select-none"
              aria-hidden
            >
              .
            </div>

            <div className="relative min-w-0 sm:col-start-1 sm:row-start-2">
              {selectedPickerUser ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <span className="block text-sm leading-snug text-card-foreground">
                    {userOptionLabel(selectedPickerUser)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserId(null);
                      setUserSearchQuery("");
                    }}
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
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or Discord…"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground"
                    aria-label="Search users without a position"
                  />
                  {userSearchQuery.trim() ? (
                    <ul
                      className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-auto rounded-lg border border-border bg-card py-1 shadow-md"
                      role="listbox"
                      aria-label="Matching users"
                    >
                      {userSearchMatches.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                          No users match that search.
                        </li>
                      ) : (
                        userSearchMatches.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              role="option"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                setSelectedUserId(u.id);
                                setUserSearchQuery("");
                              }}
                            >
                              <span className="font-medium text-card-foreground">
                                {[u.first_name, u.last_name].filter(Boolean).join(" ") ||
                                  "—"}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {u.email}
                              </span>
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
                      {usersWithoutPosition.length} member
                      {usersWithoutPosition.length !== 1 ? "s" : ""} without a position — type
                      to narrow the list.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="relative min-w-0 sm:col-start-2 sm:row-start-2">
              {selectedPositionTitle ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-card-foreground">{selectedPositionTitle}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPositionTitle(null);
                      setPositionSearchQuery("");
                    }}
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
                    value={positionSearchQuery}
                    onChange={(e) => setPositionSearchQuery(e.target.value)}
                    placeholder="Search position title…"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground"
                    aria-label="Search position titles"
                  />
                  {positionSearchQuery.trim() ? (
                    <ul
                      className="absolute left-0 right-0 z-10 mt-1 max-h-52 overflow-auto rounded-lg border border-border bg-card py-1 shadow-md"
                      role="listbox"
                      aria-label="Matching positions"
                    >
                      {positionSearchMatches.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                          No positions match that search.
                        </li>
                      ) : (
                        positionSearchMatches.map((p) => (
                          <li key={p.title}>
                            <button
                              type="button"
                              role="option"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                setSelectedPositionTitle(p.title);
                                setPositionSearchQuery("");
                              }}
                            >
                              <span className="font-medium text-card-foreground">{p.title}</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {positionTitles.length} active position
                      {positionTitles.length !== 1 ? "s" : ""} — type to narrow the list.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 sm:col-start-3 sm:row-start-2 sm:self-start">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setUserSearchQuery("");
                  setSelectedUserId(null);
                  setPositionSearchQuery("");
                  setSelectedPositionTitle(null);
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
          {!message && usersWithoutPosition.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              User list is empty: everyone may already have a position, or the server could not load members
              (check SUPABASE_SERVICE_ROLE_KEY and your account&apos;s manage permission).
            </p>
          )}
          {!message && positionTitles.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              No active positions found in <code className="rounded bg-muted px-1">positions</code>. Add or
              activate positions under the Positions tab.
            </p>
          )}
        </section>
      )}

      {showAssignments && editingRow && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">
            Edit {displayName(editingRow)}
          </h2>
          <form onSubmit={handleUpdate} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Position
              </label>
              <select
                name="positionTitle"
                defaultValue={editingRow.positionTitle ?? ""}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
              >
                <option value="">None</option>
                {positionTitles.map((p) => (
                  <option key={p.title} value={p.title}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_active"
                id="edit_is_active"
                defaultChecked={editingRow.is_active ?? true}
                className="rounded border-border"
              />
              <label htmlFor="edit_is_active" className="text-sm text-muted-foreground">
                Active
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {showAssignments && (
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">Officer assignments</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {officers.length} assignment{officers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  User
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Position
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Branch
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Status
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Updated
                </th>
                {canManage && (
                  <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {officers.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 6 : 5}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No officer assignments yet.
                  </td>
                </tr>
              ) : (
                officers.map((row) => (
                  <tr key={row.id} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-card-foreground sm:px-6">
                      {displayName(row)}
                      <span className="block text-xs text-muted-foreground">{row.user_email}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {row.positionTitle ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {row.branch_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6">
                      <span
                        className={
                          row.is_active
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }
                      >
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDate(row.updated_at)}
                    </td>
                    {canManage && (
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm sm:px-6">
                        <button
                          type="button"
                          onClick={() => openEdit(row.id)}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Edit
                        </button>
                        {row.is_active && (
                          <>
                            {" · "}
                            <button
                              type="button"
                              onClick={() => handleDeactivate(row.id)}
                              disabled={busy}
                              className="font-medium text-red-600 hover:underline dark:text-red-400 disabled:opacity-50"
                            >
                              Deactivate
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
}
