"use client";

import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/shadcn/tabs";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { PointCategoryRow } from "../point-information/actions";
import { PointInformationContent } from "../point-information/PointInformationContent";
import { useRouter } from "next/navigation";
import { filterUsersByQuery } from "@/lib/user-search";
import type {
  AwardablePerson,
  ManagedPointTransactionRow,
  CreateIndividualPointTransactionInput,
} from "./actions";
import { createIndividualPointTransactionForUser, getManagedPointTransactionsForUsersWithPoints } from "./actions";

type Props = {
  initialCategories: PointCategoryRow[];
  canManageCategories: boolean;
  canManagePoints: boolean;
  canViewPointsTransactions: boolean;
  people: AwardablePerson[];
};

type TabKey = "point_information" | "individual_transaction" | "all_transactions";

export function PointManagementContent({
  initialCategories,
  canManageCategories,
  canManagePoints,
  canViewPointsTransactions,
  people,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("point_information");
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  const [categories, setCategories] = useState(initialCategories);
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  // Individual transaction form
  const [txUserId, setTxUserId] = useState<string>("");
  const [txCategoryId, setTxCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [txBusy, setTxBusy] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [membersOnly, setMembersOnly] = useState(true);
  const [txResult, setTxResult] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const searchPool = useMemo(
    () => (membersOnly ? people.filter((p) => p.is_member) : people),
    [people, membersOnly]
  );
  const memberMatches = useMemo(
    () => filterUsersByQuery(searchPool, memberSearch),
    [searchPool, memberSearch]
  );
  const selectedPerson = useMemo(
    () => people.find((p) => p.user_id === txUserId) ?? null,
    [people, txUserId]
  );
  // The award is the category's value; the server reads it again on submit.
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === txCategoryId) ?? null,
    [categories, txCategoryId]
  );

  useEffect(() => {
    if (!txCategoryId && categories[0]?.id) setTxCategoryId(categories[0].id);
  }, [categories, txCategoryId]);

  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [txRows, setTxRows] = useState<ManagedPointTransactionRow[]>([]);
  const [txTotalCount, setTxTotalCount] = useState(0);
  const [txError, setTxError] = useState<string | null>(null);

  const loadTxs = useCallback(async () => {
    setLoadingTxs(true);
    setTxError(null);
    const res = await getManagedPointTransactionsForUsersWithPoints({ page, pageSize: PAGE_SIZE });
    setLoadingTxs(false);
    if (res.error) {
      setTxError(res.error);
      return;
    }
    setTxRows(res.data);
    setTxTotalCount(res.totalCount);
  }, [page]);

  useEffect(() => {
    if (tab !== "all_transactions") return;
    void loadTxs();
  }, [tab, loadTxs]);

  const totalPages = useMemo(() => {
    const pages = Math.ceil(txTotalCount / PAGE_SIZE);
    return Math.max(1, pages);
  }, [txTotalCount]);

  const submitIndividual = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setMessage(null);
      if (!canManagePoints) {
        setMessage({ type: "error", text: "You do not have permission to manage point transactions." });
        return;
      }
      if (!txUserId) {
        setMessage({ type: "error", text: "Please choose a user." });
        return;
      }
      if (!txCategoryId) {
        setMessage({ type: "error", text: "Please choose a point category." });
        return;
      }
      setTxBusy(true);
      setTxResult(null);
      const payload: CreateIndividualPointTransactionInput = {
        user_id: txUserId,
        category_id: txCategoryId,
      };

      const res = await createIndividualPointTransactionForUser(payload);
      setTxBusy(false);
      if (res.error) {
        setTxResult({ type: "error", text: res.error });
        return;
      }
      setTxResult({ type: "ok", text: "Point transaction created." });

      // Hold the confirmation briefly, then clear the form and pull fresh data.
      // router.refresh() rather than a reload so the officer keeps this tab and
      // can award again immediately.
      window.setTimeout(() => {
        setTxUserId("");
        setMemberSearch("");
        setTxResult(null);
        router.refresh();
        void loadTxs();
      }, 1000);
    },
    [canManagePoints, loadTxs, router, txCategoryId, txUserId]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Point management</h1>
        <p className="text-muted-foreground">
          Manage point categories and create point transactions with an audit trail.
        </p>
      </div>

      {message ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
        <TabsTrigger value="point_information">Point Information</TabsTrigger>

        {canManagePoints ? (
          <TabsTrigger value="individual_transaction">Individual point transaction</TabsTrigger>
        ) : null}

        {canViewPointsTransactions ? (
          <TabsTrigger value="all_transactions">Point transactions (all)</TabsTrigger>
        ) : null}
      </TabsList>
      </Tabs>

      {tab === "point_information" ? (
        <PointInformationContent initialCategories={categories} canManage={canManageCategories} />
      ) : null}

      {tab === "individual_transaction" ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">Create a point transaction</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add points to a member and record who made the change.
          </p>

          <form onSubmit={submitIndividual} className="mt-6 space-y-4">
            {txResult ? (
              <p
                role="status"
                className={`text-sm font-medium ${
                  txResult.type === "ok"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {txResult.text}
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Member
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={membersOnly}
                      onChange={(e) => {
                        setMembersOnly(e.target.checked);
                        setTxUserId("");
                      }}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    Members only
                  </label>
                </div>

                {selectedPerson ? (
                  <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-card-foreground">
                        {[selectedPerson.first_name, selectedPerson.last_name]
                          .filter(Boolean)
                          .join(" ") || "Unnamed member"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedPerson.email ?? "No email on file"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTxUserId("");
                        setMemberSearch("");
                      }}
                      className="shrink-0 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="search"
                      autoComplete="off"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search by name, email, or Discord…"
                      disabled={!canManagePoints}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                      aria-label="Search members"
                    />
                    {memberSearch.trim() ? (
                      <ul
                        className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-auto rounded-lg border border-border bg-card py-1 shadow-md"
                        role="listbox"
                        aria-label="Matching members"
                      >
                        {memberMatches.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-muted-foreground">
                            {membersOnly
                              ? "No members match. Untick Members only to search everyone."
                              : "No users match that search."}
                          </li>
                        ) : (
                          memberMatches.map((p) => (
                            <li key={p.user_id}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={p.user_id === txUserId}
                                onClick={() => {
                                  setTxUserId(p.user_id);
                                  setMemberSearch("");
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                              >
                                <span className="block text-card-foreground">
                                  {[p.first_name, p.last_name].filter(Boolean).join(" ") ||
                                    "Unnamed member"}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {p.email ?? "No email"} · {p.total_points} pts
                                  {p.is_member ? "" : " · not a member"}
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Category
                </label>
                <select
                  value={txCategoryId}
                  onChange={(e) => setTxCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.points_value} pts default)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Points to award
                </label>
                {/* Read-only: the award is the category's value, and the server
                    reads it again on submit rather than trusting this field. */}
                <p className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                  {selectedCategory
                    ? `${selectedCategory.points_value} pts`
                    : "Choose a category"}
                </p>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={txBusy || !canManagePoints || !txUserId}
                  className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {txBusy ? "Creating..." : "Create transaction"}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              {selectedPerson ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Current points</span>
                  <span className="text-lg font-semibold tabular-nums text-card-foreground">
                    {selectedPerson.total_points}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  Search for a member above to see their current points.
                </span>
              )}
            </div>
          </form>
        </section>
      ) : null}

      {tab === "all_transactions" ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Point transactions</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Showing transactions for users with current points.
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {txTotalCount} total
            </div>
          </div>

          {txError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {txError}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Date
                  </th>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    User
                  </th>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Category
                  </th>
                  <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {loadingTxs ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground sm:px-6">
                      Loading...
                    </td>
                  </tr>
                ) : txRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground sm:px-6">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  txRows.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-card-foreground sm:px-6">
                        {tx.created_at
                          ? new Date(tx.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">{tx.user_name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">{tx.category_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-card-foreground sm:px-6">
                        {tx.points_earned != null ? `+${tx.points_earned}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {txTotalCount > PAGE_SIZE ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0 || loadingTxs}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1 || loadingTxs}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

