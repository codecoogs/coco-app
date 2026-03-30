"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  createBranch,
  getBranchesForManage,
  updateBranch,
  type BranchManageRow,
} from "./actions";

type Props = {
  initialBranches: BranchManageRow[];
  loadError: string | null;
};

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

export function BranchesPanel({ initialBranches, loadError }: Props) {
  const router = useRouter();
  const [branches, setBranches] = useState(initialBranches);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BranchManageRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    setBranches(initialBranches);
  }, [initialBranches]);

  const refreshFromServer = useCallback(async () => {
    const res = await getBranchesForManage();
    if (!res.error) setBranches(res.data);
    router.refresh();
  }, [router]);

  const handleCreate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const name = (form.elements.namedItem("name") as HTMLInputElement).value;
      const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
      const is_active = (form.elements.namedItem("is_active") as HTMLInputElement).checked;
      setBusy(true);
      setMessage(null);
      const { error } = await createBranch(name, description.trim() || null, is_active);
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setMessage({ type: "ok", text: "Branch created." });
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
      const name = (form.elements.namedItem("name") as HTMLInputElement).value;
      const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
      const is_active = (form.elements.namedItem("is_active") as HTMLInputElement).checked;
      setBusy(true);
      setMessage(null);
      const { error } = await updateBranch(editing.id, {
        name,
        description: description.trim() || null,
        is_active,
      });
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setMessage({ type: "ok", text: "Branch updated." });
      setEditing(null);
      await refreshFromServer();
    },
    [editing, refreshFromServer]
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
          Add branch
        </button>
      </div>

      {adding && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">New branch</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                placeholder="Unique branch name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_active"
                id="new_branch_active"
                defaultChecked
                className="rounded border-border"
              />
              <label htmlFor="new_branch_active" className="text-sm text-muted-foreground">
                Active
              </label>
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
          <h2 className="text-lg font-semibold text-card-foreground">Edit branch</h2>
          <form key={editing.id} onSubmit={handleUpdate} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                name="name"
                required
                defaultValue={editing.name}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                defaultValue={editing.description ?? ""}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_active"
                id="edit_branch_active"
                defaultChecked={editing.is_active}
                className="rounded border-border"
              />
              <label htmlFor="edit_branch_active" className="text-sm text-muted-foreground">
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
          <h2 className="text-lg font-semibold text-card-foreground">Branches</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {branches.length} branch{branches.length !== 1 ? "es" : ""} — names must stay unique.
            Inactive branches are hidden from position assignment dropdowns.
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
                  Active
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Description
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Updated
                </th>
                <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {branches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground sm:px-6">
                    No branches yet.
                  </td>
                </tr>
              ) : (
                branches.map((row) => (
                  <tr key={row.id} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                      {row.name}
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
                    <td className="max-w-md px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {row.description?.trim() || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDate(row.updated_at)}
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
