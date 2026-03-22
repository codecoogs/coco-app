"use client";

import { useProfileOptional } from "@/app/contexts/ProfileContext";
import {
  createOfficer,
  deactivateOfficer,
  getPositionTitles,
  getUsersWithoutPosition,
  updateOfficer,
} from "./actions";
import type { OfficerRow, PositionTitleOption } from "./actions";
import { useCallback, useState } from "react";

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

type Props = { officers: OfficerRow[]; canManage: boolean };

export function OfficersContent({ officers: initialOfficers, canManage }: Props) {
  const { refetchProfile } = useProfileOptional() ?? {};
  const [officers, setOfficers] = useState(initialOfficers);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [positionTitles, setPositionTitles] = useState<PositionTitleOption[]>([]);
  const [usersWithoutPosition, setUsersWithoutPosition] = useState<
    { id: string; email: string; first_name: string; last_name: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  const openAdd = useCallback(async () => {
    setAdding(true);
    setMessage(null);
    const [titlesRes, usersRes] = await Promise.all([
      getPositionTitles(),
      getUsersWithoutPosition(),
    ]);
    if (titlesRes.error) setMessage({ type: "error", text: titlesRes.error });
    else setPositionTitles(titlesRes.data);
    if (usersRes.error) setMessage((m) => m || { type: "error", text: usersRes.error });
    else setUsersWithoutPosition(usersRes.data);
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
      const form = e.currentTarget;
      const user_id = (form.elements.namedItem("user_id") as HTMLSelectElement).value;
      const positionTitle = (form.elements.namedItem("positionTitle") as HTMLSelectElement).value;
      if (!user_id || !positionTitle) return;
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
    [refetchProfile]
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            Add officer
          </button>
        </div>
      )}

      {adding && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">Add officer</h2>
          <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                User
              </label>
              <select
                name="user_id"
                required
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
              >
                <option value="">Select user…</option>
                {usersWithoutPosition.map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email} (
                    {u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Position
              </label>
              <select
                name="positionTitle"
                required
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
              >
                <option value="">Select position…</option>
                {positionTitles.map((p) => (
                  <option key={p.title} value={p.title}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Add"}
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

      {editingRow && (
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
                    colSpan={canManage ? 5 : 4}
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
    </div>
  );
}
