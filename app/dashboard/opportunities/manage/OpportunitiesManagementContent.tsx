"use client";

import { OPPORTUNITY_CATEGORIES, type Opportunity } from "@/lib/types/opportunities";
import { useCallback, useMemo, useState } from "react";
import {
  bulkSetOpportunitiesActive,
  deleteOpportunity,
  getOpportunitiesForManage,
  setOpportunityActive,
} from "../actions";
import { ImportOpportunitiesModal } from "./ImportOpportunitiesModal";
import { OpportunityFormModal } from "./OpportunityFormModal";

type Props = {
  initialOpportunities: Opportunity[];
};

type StatusFilter = "all" | "active" | "inactive";

export function OpportunitiesManagementContent({ initialOpportunities }: Props) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(
    null
  );

  const [formModal, setFormModal] = useState<
    { mode: "create" } | { mode: "edit"; opportunity: Opportunity } | null
  >(null);
  const [importOpen, setImportOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await getOpportunitiesForManage();
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setOpportunities(res.data);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (categoryFilter !== "all" && o.category !== categoryFilter) return false;
      if (statusFilter === "active" && !o.is_active) return false;
      if (statusFilter === "inactive" && o.is_active) return false;
      if (!q) return true;
      return (
        o.title.toLowerCase().includes(q) ||
        (o.company_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [opportunities, search, categoryFilter, statusFilter]);

  const pendingReviewCount = useMemo(
    () => opportunities.filter((o) => o.source === "csv_import" && !o.is_active).length,
    [opportunities]
  );

  const inactiveFilteredIds = useMemo(
    () => filtered.filter((o) => !o.is_active).map((o) => o.id),
    [filtered]
  );

  const handleActivateAll = useCallback(async () => {
    if (!inactiveFilteredIds.length) return;
    if (
      !confirm(
        `Activate ${inactiveFilteredIds.length} opportunity(ies)? They'll immediately become visible to members.`
      )
    )
      return;
    setBusy(true);
    const res = await bulkSetOpportunitiesActive(inactiveFilteredIds, true);
    setBusy(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setMessage({ type: "ok", text: `Activated ${res.updated} opportunity(ies).` });
    await refresh();
  }, [inactiveFilteredIds, refresh]);

  const handleToggleActive = useCallback(
    async (o: Opportunity) => {
      setBusy(true);
      const res = await setOpportunityActive(o.id, !o.is_active);
      setBusy(false);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      await refresh();
    },
    [refresh]
  );

  const handleDelete = useCallback(
    async (o: Opportunity) => {
      if (!confirm(`Delete "${o.title}"? This cannot be undone.`)) return;
      setBusy(true);
      const res = await deleteOpportunity(o.id);
      setBusy(false);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      await refresh();
    },
    [refresh]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or company…"
            className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground sm:w-64"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All categories</option>
            {OPPORTUNITY_CATEGORIES.map((c) => (
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
        <div className="flex gap-2">
          {inactiveFilteredIds.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={handleActivateAll}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
            >
              Activate all ({inactiveFilteredIds.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => setFormModal({ mode: "create" })}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New opportunity
          </button>
        </div>
      </div>

      {pendingReviewCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          {pendingReviewCount} imported posting{pendingReviewCount === 1 ? "" : "s"}{" "}
          waiting for review before they go live. Filter by &quot;Inactive&quot; to find them.
        </div>
      )}

      {message && (
        <p
          className={
            message.type === "ok"
              ? "text-sm text-green-700 dark:text-green-300"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      )}

      {!filtered.length ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No opportunities match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Employment type</th>
                <th className="px-4 py-3 font-medium">Field</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{o.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {o.company_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {o.category ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {o.employment_type ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {o.field ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        o.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {o.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {o.source === "csv_import" ? "CSV import" : "Manual"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setFormModal({ mode: "edit", opportunity: o })}
                        className="text-foreground hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleActive(o)}
                        className="text-foreground hover:underline disabled:opacity-50"
                      >
                        {o.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDelete(o)}
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
        <OpportunityFormModal
          mode={formModal.mode}
          opportunity={formModal.mode === "edit" ? formModal.opportunity : undefined}
          onClose={() => setFormModal(null)}
          onSaved={refresh}
        />
      )}

      {importOpen && (
        <ImportOpportunitiesModal onClose={() => setImportOpen(false)} onImported={refresh} />
      )}
    </div>
  );
}
