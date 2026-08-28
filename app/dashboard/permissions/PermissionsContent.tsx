"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPermission,
  getPermissionsForManage,
  getPositionPermissionMatrixForManage,
  getRolePermissionsMatrixForManage,
  setRolePermissionsForManage,
  setPositionPermissionsForManage,
  type PositionPermissionMatrixRow,
  type PermissionRow,
  type RolePermissionsMatrixData,
} from "./actions";

type Props = {
  initialRows: PermissionRow[];
  initialRolePermissionsMatrix: RolePermissionsMatrixData;
  initialPositionPermissionMatrix: PositionPermissionMatrixRow[];
  canManage: boolean;
  loadError: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function PermissionsContent({
  initialRows,
  initialRolePermissionsMatrix,
  initialPositionPermissionMatrix,
  canManage,
  loadError,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [rolePermissionsMatrix, setRolePermissionsMatrix] = useState(
    initialRolePermissionsMatrix
  );
  const [positionMatrix, setPositionMatrix] = useState(initialPositionPermissionMatrix);
  const [tab, setTab] = useState<"permissions" | "role_permissions" | "position_permissions">(
    "permissions"
  );
  const [search, setSearch] = useState("");
  const [prefixFilter, setPrefixFilter] = useState<"all" | "view" | "manage" | "other">("all");
  const PERMISSIONS_PAGE_SIZE = 20;
  const [permissionsPage, setPermissionsPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(
    null
  );

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
  useEffect(() => {
    setRolePermissionsMatrix(initialRolePermissionsMatrix);
  }, [initialRolePermissionsMatrix]);
  useEffect(() => {
    setPositionMatrix(initialPositionPermissionMatrix);
  }, [initialPositionPermissionMatrix]);

  const filteredRows = rows.filter((r) => {
    const n = (r.name ?? "").toLowerCase();
    const d = (r.description ?? "").toLowerCase();
    const q = search.trim().toLowerCase();
    const matchesQuery = !q || n.includes(q) || d.includes(q);

    let matchesPrefix = true;
    if (prefixFilter === "view") matchesPrefix = n.startsWith("view_");
    else if (prefixFilter === "manage") matchesPrefix = n.startsWith("manage_");
    else if (prefixFilter === "other") {
      matchesPrefix = !n.startsWith("view_") && !n.startsWith("manage_");
    }

    return matchesQuery && matchesPrefix;
  });

  useEffect(() => {
    // Reset pagination whenever the search/filter changes.
    setPermissionsPage(0);
  }, [search, prefixFilter]);

  const permissionsPageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / PERMISSIONS_PAGE_SIZE)
  );
  const safePermissionsPage = Math.min(permissionsPage, permissionsPageCount - 1);
  const paginatedPermissions = filteredRows.slice(
    safePermissionsPage * PERMISSIONS_PAGE_SIZE,
    safePermissionsPage * PERMISSIONS_PAGE_SIZE + PERMISSIONS_PAGE_SIZE
  );

  const refresh = useCallback(async () => {
    const [res, rr, pm] = await Promise.all([
      getPermissionsForManage(),
      getRolePermissionsMatrixForManage(),
      getPositionPermissionMatrixForManage(),
    ]);
    if (!res.error) setRows(res.data);
    if (!rr.error) setRolePermissionsMatrix(rr.data);
    if (!pm.error) setPositionMatrix(pm.data);
    router.refresh();
  }, [router]);

  const roles = useMemo(() => rolePermissionsMatrix.roles ?? [], [rolePermissionsMatrix.roles]);
  const permissionsForMatrix = rolePermissionsMatrix.permissions ?? [];
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(
    roles.length ? roles[0]?.id ?? null : null
  );
  const [rolePendingChanges, setRolePendingChanges] = useState<Record<string, boolean>>({});
  const [savingRolePermissions, setSavingRolePermissions] = useState(false);

  useEffect(() => {
    if (roles.length === 0) {
      setSelectedRoleId(null);
      return;
    }
    if (selectedRoleId == null) {
      setSelectedRoleId(roles[0]?.id ?? null);
      return;
    }
    const exists = roles.some((r) => r.id === selectedRoleId);
    if (!exists) setSelectedRoleId(roles[0]?.id ?? null);
  }, [roles, selectedRoleId]);

  // Clears pending edits whenever the selected role changes (the role
  // selector is disabled while dirty, so in practice this only fires after
  // a save/discard or on initial selection).
  useEffect(() => {
    setRolePendingChanges({});
  }, [selectedRoleId]);

  const rolePermissionIdsBaseline = new Set<string>(
    selectedRoleId == null
      ? []
      : rolePermissionsMatrix.rolePermissionIds[String(selectedRoleId)] ?? []
  );

  const roleDirtyEntries = Object.entries(rolePendingChanges).filter(
    ([permissionId, enabled]) => enabled !== rolePermissionIdsBaseline.has(permissionId)
  );
  const roleHasChanges = roleDirtyEntries.length > 0;

  const toggleRolePermission = useCallback((permissionId: string, enabled: boolean) => {
    setMessage(null);
    setRolePendingChanges((prev) => ({ ...prev, [permissionId]: enabled }));
  }, []);

  const saveRolePermissions = useCallback(async () => {
    if (selectedRoleId == null || roleDirtyEntries.length === 0) return;
    setSavingRolePermissions(true);
    setMessage(null);
    const { error } = await setRolePermissionsForManage(
      selectedRoleId,
      roleDirtyEntries.map(([permissionId, enabled]) => ({ permissionId, enabled }))
    );
    setSavingRolePermissions(false);
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }
    setRolePendingChanges({});
    setMessage({ type: "ok", text: "Role permissions saved." });
    await refresh();
  }, [selectedRoleId, roleDirtyEntries, refresh]);

  const discardRoleChanges = useCallback(() => {
    setRolePendingChanges({});
    setMessage(null);
  }, []);

  const positions = useMemo(() => positionMatrix ?? [], [positionMatrix]);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(
    positions.length ? positions[0]?.position_id ?? null : null
  );
  // Keyed by permission name (direct_permissions/inherited_permissions are
  // name arrays), mapped to permission_id only when saving.
  const [positionPendingChanges, setPositionPendingChanges] = useState<Record<string, boolean>>(
    {}
  );
  const [savingPositionPermissions, setSavingPositionPermissions] = useState(false);

  useEffect(() => {
    if (positions.length === 0) {
      setSelectedPositionId(null);
      return;
    }
    if (selectedPositionId == null) {
      setSelectedPositionId(positions[0]?.position_id ?? null);
      return;
    }
    const exists = positions.some((p) => p.position_id === selectedPositionId);
    if (!exists) setSelectedPositionId(positions[0]?.position_id ?? null);
  }, [positions, selectedPositionId]);

  // Position selector is disabled while dirty, so this only fires after a
  // save/discard or on initial selection.
  useEffect(() => {
    setPositionPendingChanges({});
  }, [selectedPositionId]);

  const selectedPosition =
    positions.find((p) => p.position_id === selectedPositionId) ?? null;
  const directNameSet = new Set<string>(selectedPosition?.direct_permissions ?? []);
  const inheritedNameSet = new Set<string>(selectedPosition?.inherited_permissions ?? []);

  const positionDirtyEntries = Object.entries(positionPendingChanges).filter(
    ([name, enabled]) => enabled !== directNameSet.has(name)
  );
  const positionHasChanges = positionDirtyEntries.length > 0;

  const togglePositionPermission = useCallback((permissionName: string, enabled: boolean) => {
    setMessage(null);
    setPositionPendingChanges((prev) => ({ ...prev, [permissionName]: enabled }));
  }, []);

  const savePositionPermissions = useCallback(async () => {
    if (selectedPositionId == null || positionDirtyEntries.length === 0) return;
    setSavingPositionPermissions(true);
    setMessage(null);

    const changes: { permissionId: string; enabled: boolean }[] = [];
    for (const [name, enabled] of positionDirtyEntries) {
      const permRow = rows.find((r) => r.name === name);
      if (!permRow) {
        setSavingPositionPermissions(false);
        setMessage({
          type: "error",
          text: `Permission not found in current list: ${name}`,
        });
        return;
      }
      changes.push({ permissionId: permRow.id, enabled });
    }

    const { error } = await setPositionPermissionsForManage(selectedPositionId, changes);
    setSavingPositionPermissions(false);
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }
    setPositionPendingChanges({});
    setMessage({ type: "ok", text: "Position permissions saved." });
    await refresh();
  }, [selectedPositionId, positionDirtyEntries, rows, refresh]);

  const discardPositionChanges = useCallback(() => {
    setPositionPendingChanges({});
    setMessage(null);
  }, []);

  const handleCreate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const name = (form.elements.namedItem("name") as HTMLInputElement).value;
      const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
      setBusy(true);
      setMessage(null);
      const { error } = await createPermission(name, description.trim() || null);
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setMessage({ type: "ok", text: "Permission created." });
      setAdding(false);
      form.reset();
      await refresh();
    },
    [refresh]
  );

  return (
    <div className="space-y-4">
      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {loadError}
        </div>
      ) : null}

      {message ? (
        <div
          className={
            message.type === "error"
              ? "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
              : "rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
          }
        >
          {message.text}
        </div>
      ) : null}

      {tab === "permissions" && canManage ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAdding((v) => !v);
              setMessage(null);
            }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            {adding ? "Close add form" : "Add permission"}
          </button>
        </div>
      ) : null}

      {tab === "permissions" && canManage && adding ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">New permission</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use lowercase snake_case names, for example <code>view_teams</code>.
          </p>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Permission name <span className="text-red-600">*</span>
              </label>
              <input
                name="name"
                required
                placeholder="manage_permissions"
                className="w-full max-w-md rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full max-w-2xl rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Create permission"}
            </button>
          </form>
        </section>
      ) : null}

      <div
        className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
        role="tablist"
        aria-label="Permissions management sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "permissions"}
          onClick={() => setTab("permissions")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "permissions"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Permissions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "role_permissions"}
          onClick={() => setTab("role_permissions")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "role_permissions"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Role permissions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "position_permissions"}
          onClick={() => setTab("position_permissions")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "position_permissions"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Position permissions
        </button>
      </div>

      {tab === "permissions" ? (
        <>
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-md">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Search
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by permission name or description..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Filter
            </label>
            <div className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setPrefixFilter("all")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  prefixFilter === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setPrefixFilter("view")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  prefixFilter === "view"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                view_*
              </button>
              <button
                type="button"
                onClick={() => setPrefixFilter("manage")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  prefixFilter === "manage"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                manage_*
              </button>
              <button
                type="button"
                onClick={() => setPrefixFilter("other")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  prefixFilter === "other"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Other
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">Available permissions</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filteredRows.length} of {rows.length} permission{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Name
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Description
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground sm:px-6">
                    No permissions match your search/filter.
                  </td>
                </tr>
              ) : (
                paginatedPermissions.map((p) => (
                  <tr key={p.id} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-card-foreground sm:px-6">
                      {p.name}
                    </td>
                    <td className="max-w-xl px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {p.description?.trim() || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredRows.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              Page {safePermissionsPage + 1} of {permissionsPageCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPermissionsPage((p) => Math.max(0, p - 1))}
                disabled={safePermissionsPage <= 0}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setPermissionsPage((p) => Math.min(permissionsPageCount - 1, p + 1))
                }
                disabled={safePermissionsPage >= permissionsPageCount - 1}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
        </>
      ) : null}

      {tab === "role_permissions" ? (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-card-foreground">Role permissions</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Choose a role, then toggle permissions on/off for that role.
            </p>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            {roles.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-muted-foreground">
                No roles found.
              </div>
            ) : (
              <>
                <div className="w-full max-w-md">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Role
                  </label>
                  <select
                    value={selectedRoleId ?? ""}
                    onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                    disabled={roleHasChanges}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {roleHasChanges ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Save or discard your changes before switching roles.
                    </p>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="max-h-96 overflow-auto">
                    <table className="min-w-full divide-y divide-border">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                            Permission
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                            Description
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                            Enabled
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-card">
                        {permissionsForMatrix.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                            >
                              No permissions found.
                            </td>
                          </tr>
                        ) : (
                          permissionsForMatrix.map((p) => {
                            const checked =
                              p.id in rolePendingChanges
                                ? rolePendingChanges[p.id]
                                : rolePermissionIdsBaseline.has(p.id);
                            return (
                              <tr key={p.id} className="hover:bg-muted">
                                <td className="px-4 py-3 font-mono text-sm text-card-foreground sm:px-6">
                                  {p.name}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                                  {p.description?.trim() || "—"}
                                </td>
                                <td className="px-4 py-3 text-right sm:px-6">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={savingRolePermissions}
                                    onChange={(e) =>
                                      toggleRolePermission(p.id, e.target.checked)
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                  {roleHasChanges ? (
                    <span className="mr-auto text-sm text-muted-foreground">
                      {roleDirtyEntries.length} unsaved change
                      {roleDirtyEntries.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={discardRoleChanges}
                    disabled={!roleHasChanges || savingRolePermissions}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={saveRolePermissions}
                    disabled={!roleHasChanges || savingRolePermissions}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingRolePermissions ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}

      {tab === "position_permissions" ? (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-card-foreground">Position permissions</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Effective permissions = inherited from role + position-specific grants.
            </p>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            {positions.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-muted-foreground">
                No positions found.
              </div>
            ) : (
              <>
                <div className="w-full max-w-md">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Position
                  </label>
                  <select
                    value={selectedPositionId ?? ""}
                    onChange={(e) => setSelectedPositionId(Number(e.target.value))}
                    disabled={positionHasChanges}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
                  >
                    {positions.map((p) => (
                      <option key={p.position_id} value={p.position_id}>
                        {p.position_title}
                      </option>
                    ))}
                  </select>
                  {positionHasChanges ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Save or discard your changes before switching positions.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-border bg-card p-0.5">
                  <div className="px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Direct permissions edit <code>position_permissions</code>. Role permissions are inherited and cannot be removed here.
                    </p>
                    {selectedPosition?.role_name ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Role: <span className="font-medium">{selectedPosition.role_name}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="overflow-hidden rounded-b-lg border-t border-border">
                    <div className="max-h-96 overflow-auto">
                      <table className="min-w-full divide-y divide-border">
                        <thead>
                          <tr className="bg-muted/40">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                              Permission
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                              Inherited
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                              Direct toggle
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground sm:px-6">
                                No permissions found.
                              </td>
                            </tr>
                          ) : (
                            rows.map((p) => {
                              const inherited = inheritedNameSet.has(p.name);
                              const direct =
                                p.name in positionPendingChanges
                                  ? positionPendingChanges[p.name]
                                  : directNameSet.has(p.name);
                              const effective = inherited || direct;
                              return (
                                <tr key={p.id} className="hover:bg-muted">
                                  <td className="px-4 py-3 font-mono text-sm text-card-foreground sm:px-6">
                                    {p.name}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                                    {inherited ? "Yes" : "—"}
                                  </td>
                                  <td className="px-4 py-3 text-right sm:px-6">
                                    <label className="inline-flex items-center justify-end gap-2">
                                      <input
                                        type="checkbox"
                                        checked={direct}
                                        disabled={savingPositionPermissions}
                                        onChange={(e) =>
                                          togglePositionPermission(
                                            p.name,
                                            e.target.checked
                                          )
                                        }
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        {effective ? "On" : "Off"}
                                      </span>
                                    </label>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                  {positionHasChanges ? (
                    <span className="mr-auto text-sm text-muted-foreground">
                      {positionDirtyEntries.length} unsaved change
                      {positionDirtyEntries.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={discardPositionChanges}
                    disabled={!positionHasChanges || savingPositionPermissions}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={savePositionPermissions}
                    disabled={!positionHasChanges || savingPositionPermissions}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingPositionPermissions ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
