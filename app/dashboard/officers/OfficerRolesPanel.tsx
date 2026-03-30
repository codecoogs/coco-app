"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPositionsForManage,
  updatePosition,
  type BranchOption,
  type PositionManageRow,
  type RoleOption,
} from "./actions";

type Props = {
  initialPositions: PositionManageRow[];
  branchOptions: BranchOption[];
  roleOptions: RoleOption[];
  loadError: string | null;
};

function truncate(s: string | null, max: number) {
  if (!s) return "—";
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function OfficerRolesPanel({
  initialPositions,
  branchOptions,
  roleOptions,
  loadError,
}: Props) {
  const [positions, setPositions] = useState(initialPositions);
  const [editing, setEditing] = useState<PositionManageRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  const handleSave = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editing) return;
      const form = e.currentTarget;
      const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
      const is_active = (form.elements.namedItem("is_active") as HTMLInputElement).checked;
      const branchVal = (form.elements.namedItem("branch_id") as HTMLSelectElement).value;
      const roleVal = (form.elements.namedItem("role_id") as HTMLSelectElement).value;
      const branch_id = branchVal === "" ? null : Number(branchVal);
      const role_id = roleVal === "" ? null : Number(roleVal);

      setBusy(true);
      setMessage(null);
      const { error } = await updatePosition(editing.id, {
        description: description.trim() || null,
        is_active,
        branch_id,
        role_id,
      });
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setMessage({ type: "ok", text: "Position updated." });
      setEditing(null);
      const res = await getPositionsForManage();
      if (!res.error) setPositions(res.data);
    },
    [editing]
  );

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {loadError}
        </div>
      )}
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

      {editing && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">Edit position: {editing.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Title is fixed so existing officer assignments keep a valid link.
          </p>
          <form key={editing.id} onSubmit={handleSave} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                name="description"
                defaultValue={editing.description ?? ""}
                rows={4}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Branch
                </label>
                <select
                  name="branch_id"
                  defaultValue={editing.branch_id != null ? String(editing.branch_id) : ""}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                >
                  <option value="">None</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Role
                </label>
                <select
                  name="role_id"
                  defaultValue={editing.role_id != null ? String(editing.role_id) : ""}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                >
                  <option value="">None</option>
                  {roleOptions.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_active"
                id="pos_is_active"
                defaultChecked={editing.is_active}
                className="rounded border-border"
              />
              <label htmlFor="pos_is_active" className="text-sm text-muted-foreground">
                Position is active (available for new assignments)
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
                onClick={() => setEditing(null)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">Officer roles (positions)</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {positions.length} position{positions.length !== 1 ? "s" : ""} — edit description, branch,
            linked role, and whether the role is active.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Title
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Branch
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Role
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Active
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Description
                </th>
                <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground sm:px-6">
                    No positions found.
                  </td>
                </tr>
              ) : (
                positions.map((row) => (
                  <tr key={row.id} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                      {row.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {row.branch_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {row.role_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6">
                      <span
                        className={
                          row.is_active
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }
                      >
                        {row.is_active ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {truncate(row.description, 72)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm sm:px-6">
                      <button
                        type="button"
                        onClick={() => {
                          setMessage(null);
                          setEditing(row);
                        }}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit
                      </button>
                    </td>
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
