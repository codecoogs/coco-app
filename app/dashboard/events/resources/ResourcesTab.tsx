"use client";

import type { Resource } from "@/lib/types/resources";
import { useCallback, useMemo, useState } from "react";
import {
  deleteResource,
  getResourcesForManage,
  setResourceActive,
  setResourceWebsiteViewable,
} from "./actions";
import { ResourceFormModal } from "./ResourceFormModal";

type Props = {
  initialResources: Resource[];
};

type StatusFilter = "all" | "active" | "inactive";

export function ResourcesTab({ initialResources }: Props) {
  const [resources, setResources] = useState(initialResources);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<
    { mode: "create" } | { mode: "edit"; resource: Resource } | null
  >(null);

  const categories = useMemo(
    () =>
      [...new Set(resources.map((r) => r.category))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [resources]
  );

  const refresh = useCallback(async () => {
    const res = await getResourcesForManage();
    if (res.error) {
      setError(res.error);
      return;
    }
    setResources(res.data);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (statusFilter === "active" && !r.is_active) return false;
      if (statusFilter === "inactive" && r.is_active) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
      );
    });
  }, [resources, search, categoryFilter, statusFilter]);

  const run = useCallback(
    async (action: () => Promise<{ error: string | null }>) => {
      setBusy(true);
      const res = await action();
      setBusy(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      await refresh();
    },
    [refresh]
  );

  const handleDelete = useCallback(
    async (r: Resource) => {
      if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
      await run(() => deleteResource(r.id));
    },
    [run]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or category…"
            className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground sm:w-64"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => setFormModal({ mode: "create" })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New resource
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!filtered.length ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No resources match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Link</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Website</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{r.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.extension ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.resource_date ?? "—"}
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-muted-foreground">
                    <a
                      href={r.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate hover:underline"
                    >
                      {r.link_url}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(() => setResourceWebsiteViewable(r.id, !r.website_viewable))
                      }
                      title={
                        r.website_viewable && !r.is_active
                          ? "Flagged for the website, but inactive resources are not served."
                          : undefined
                      }
                      className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                        r.website_viewable
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.website_viewable ? "Shown" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setFormModal({ mode: "edit", resource: r })}
                        className="text-foreground hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => setResourceActive(r.id, !r.is_active))}
                        className="text-foreground hover:underline disabled:opacity-50"
                      >
                        {r.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDelete(r)}
                        className="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formModal && (
        <ResourceFormModal
          mode={formModal.mode}
          resource={formModal.mode === "edit" ? formModal.resource : undefined}
          categories={categories}
          onClose={() => setFormModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
