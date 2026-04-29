"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPosition,
  deletePosition,
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

export function PositionsPanel({ initialPositions, branchOptions, roleOptions, loadError }: Props) {
  const [positions, setPositions] = useState(initialPositions);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PositionManageRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  const roleById = useMemo(() => new Map(roleOptions.map((r) => [r.id, r.name])), [roleOptions]);
  const branchById = useMemo(
    () => new Map(branchOptions.map((b) => [b.id, b.name])),
    [branchOptions]
  );

  const refreshFromServer = useCallback(async () => {
    const res = await getPositionsForManage();
    if (!res.error) setPositions(res.data);
  }, []);

  const handleCreate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const title = (form.elements.namedItem("title") as HTMLInputElement).value;
      const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
      const is_active = (form.elements.namedItem("is_active") as HTMLInputElement).checked;
      const is_admin = (form.elements.namedItem("is_admin") as HTMLInputElement).checked;
      const branchVal = (form.elements.namedItem("branch_id") as HTMLSelectElement).value;
      const roleVal = (form.elements.namedItem("role_id") as HTMLSelectElement).value;
      const branch_id = branchVal === "" ? null : Number(branchVal);
      const role_id = roleVal === "" ? null : Number(roleVal);

      setBusy(true);
      setMessage(null);
      const { error } = await createPosition({
        title,
        description: description.trim() || null,
        is_active,
        is_admin,
        branch_id,
        role_id,
      });
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setMessage({ type: "ok", text: "Position created." });
      setAdding(false);
      form.reset();
      await refreshFromServer();
    },
    [refreshFromServer]
  );

  const handleUpdate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editing) return;
      const form = e.currentTarget;
      const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
      const is_active = (form.elements.namedItem("is_active") as HTMLInputElement).checked;
      const is_admin = (form.elements.namedItem("is_admin") as HTMLInputElement).checked;
      const branchVal = (form.elements.namedItem("branch_id") as HTMLSelectElement).value;
      const roleVal = (form.elements.namedItem("role_id") as HTMLSelectElement).value;
      const branch_id = branchVal === "" ? null : Number(branchVal);
      const role_id = roleVal === "" ? null : Number(roleVal);

      setBusy(true);
      setMessage(null);
      const { error } = await updatePosition(editing.id, {
        description: description.trim() || null,
        is_active,
        is_admin,
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
      await refreshFromServer();
    },
    [editing, refreshFromServer]
  );

  const handleDelete = useCallback(
    async (row: PositionManageRow) => {
      if (
        !confirm(
          `Delete position "${row.title}"? This may fail if there are assignments referencing it.`
        )
      ) {
        return;
      }
      setBusy(true);
      setMessage(null);
      const { error } = await deletePosition(row.id);
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setMessage({ type: "ok", text: "Position deleted." });
      if (editing?.id === row.id) setEditing(null);
      await refreshFromServer();
    },
    [editing?.id, refreshFromServer]
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditing(null);
            setMessage(null);
          }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
        >
          Add position
        </button>
      </div>

      {adding && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">New position</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Title <span className="text-red-600">*</span>
              </label>
              <input
                name="title"
                required
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                placeholder="Unique position title"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                name="description"
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
                  defaultValue=""
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
                  Role type
                </label>
                <select
                  name="role_id"
                  defaultValue=""
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
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_active"
                  id="new_position_active"
                  defaultChecked
                  className="rounded border-border"
                />
                <label htmlFor="new_position_active" className="text-sm text-muted-foreground">
                  Active
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_admin"
                  id="new_position_admin"
                  defaultChecked={false}
                  className="rounded border-border"
                />
                <label htmlFor="new_position_admin" className="text-sm text-muted-foreground">
                  Admin position
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {editing && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">Edit position: {editing.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Title is fixed so existing assignments keep a valid link.
          </p>
          <form key={editing.id} onSubmit={handleUpdate} className="mt-4 space-y-4">
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
                  Role type
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
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_active"
                  id="pos_is_active"
                  defaultChecked={editing.is_active}
                  className="rounded border-border"
                />
                <label htmlFor="pos_is_active" className="text-sm text-muted-foreground">
                  Active
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_admin"
                  id="pos_is_admin"
                  defaultChecked={Boolean(editing.is_admin)}
                  className="rounded border-border"
                />
                <label htmlFor="pos_is_admin" className="text-sm text-muted-foreground">
                  Admin position
                </label>
              </div>
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
          <h2 className="text-lg font-semibold text-card-foreground">Positions</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {positions.length} position{positions.length !== 1 ? "s" : ""} — create and manage position
            definitions used for officer assignments.
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
                  Role type
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Admin
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
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground sm:px-6">
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
                      {row.branch_name ??
                        (row.branch_id != null ? branchById.get(row.branch_id) ?? "—" : "—")}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {row.role_name ??
                        (row.role_id != null ? roleById.get(row.role_id) ?? "—" : "—")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {row.is_admin ? "Yes" : "No"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6">
                      <span
                        className={
                          row.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
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
                          setAdding(false);
                          setMessage(null);
                          setEditing(row);
                        }}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit
                      </button>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={busy}
                        className="font-medium text-red-600 hover:underline dark:text-red-400 disabled:opacity-50"
                      >
                        Delete
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

