"use client";

import {
  createPointCategory,
  deletePointCategory,
  updatePointCategory,
  type PointCategoryRow,
} from "./actions";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  initialCategories: PointCategoryRow[];
  canManage: boolean;
};

export function PointInformationContent({
  initialCategories,
  canManage,
}: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);
  const [message, setMessage] = useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; row: PointCategoryRow }
    | null
  >(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const pointsRaw = (form.elements.namedItem("points_value") as HTMLInputElement)
      .value;
    const description = (
      form.elements.namedItem("description") as HTMLTextAreaElement
    ).value;
    const points_value = Number(pointsRaw);

    setBusy(true);
    setMessage(null);
    const payload = {
      name,
      points_value,
      description: description.trim() || null,
    };

    const result =
      modal?.mode === "create"
        ? await createPointCategory(payload)
        : modal?.mode === "edit"
          ? await updatePointCategory(modal.row.id, payload)
          : { error: "Invalid state." };

    setBusy(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setModal(null);
    setMessage({ type: "ok", text: "Saved." });
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? This fails if point transactions still reference it.")) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await deletePointCategory(id);
    setBusy(false);
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }
    setMessage({ type: "ok", text: "Deleted." });
    refresh();
  };

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
        <div>
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            Add category
          </button>
        </div>
      )}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">
            Point categories
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Category
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Description
                </th>
                <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Points
                </th>
                {canManage && (
                  <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {categories.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 4 : 3}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No categories found.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                      {cat.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {cat.description || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-card-foreground sm:px-6">
                      {cat.points_value} pts
                    </td>
                    {canManage && (
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm sm:px-6">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setModal({ mode: "edit", row: cat })}
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDelete(cat.id)}
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setModal(null)}
          onKeyDown={(ev) => {
            if (ev.key === "Escape" && !busy) setModal(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-card-foreground">
              {modal.mode === "create" ? "New category" : "Edit category"}
            </h3>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="pi-name"
                  className="mb-1 block text-sm font-medium text-muted-foreground"
                >
                  Name
                </label>
                <input
                  id="pi-name"
                  name="name"
                  required
                  defaultValue={modal.mode === "edit" ? modal.row.name : ""}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label
                  htmlFor="pi-points"
                  className="mb-1 block text-sm font-medium text-muted-foreground"
                >
                  Points value
                </label>
                <input
                  id="pi-points"
                  name="points_value"
                  type="number"
                  required
                  min={0}
                  step={1}
                  defaultValue={
                    modal.mode === "edit" ? modal.row.points_value : 0
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label
                  htmlFor="pi-desc"
                  className="mb-1 block text-sm font-medium text-muted-foreground"
                >
                  Description
                </label>
                <textarea
                  id="pi-desc"
                  name="description"
                  rows={3}
                  defaultValue={
                    modal.mode === "edit"
                      ? modal.row.description ?? ""
                      : ""
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
