"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { PointCategoryRow } from "../point-information/actions";
import { PointInformationContent } from "../point-information/PointInformationContent";
import type {
  UsersWithPointsOption,
  ManagedPointTransactionRow,
  CreateIndividualPointTransactionInput,
} from "./actions";
import { createIndividualPointTransactionForUser, getManagedPointTransactionsForUsersWithPoints } from "./actions";

type Props = {
  initialCategories: PointCategoryRow[];
  canManageCategories: boolean;
  canManagePoints: boolean;
  canViewPointsTransactions: boolean;
  usersWithPoints: UsersWithPointsOption[];
};

type TabKey = "point_information" | "individual_transaction" | "all_transactions";

export function PointManagementContent({
  initialCategories,
  canManageCategories,
  canManagePoints,
  canViewPointsTransactions,
  usersWithPoints,
}: Props) {
  const [tab, setTab] = useState<TabKey>("point_information");
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  const [categories, setCategories] = useState(initialCategories);
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  // Individual transaction form
  const [txUserId, setTxUserId] = useState<string>(usersWithPoints[0]?.user_id ?? "");
  const [txCategoryId, setTxCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [txPointsEarned, setTxPointsEarned] = useState<number>(0);
  const [txBusy, setTxBusy] = useState(false);

  useEffect(() => {
    if (!txUserId && usersWithPoints[0]?.user_id) setTxUserId(usersWithPoints[0].user_id);
  }, [usersWithPoints, txUserId]);

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
      if (!Number.isFinite(txPointsEarned)) {
        setMessage({ type: "error", text: "Points must be a number." });
        return;
      }

      setTxBusy(true);
      const payload: CreateIndividualPointTransactionInput = {
        user_id: txUserId,
        category_id: txCategoryId,
        points_earned: txPointsEarned,
      };

      const res = await createIndividualPointTransactionForUser(payload);
      setTxBusy(false);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      setMessage({ type: "ok", text: "Point transaction created." });

      // Refresh current subtab data.
      await loadTxs();
    },
    [canManagePoints, loadTxs, txCategoryId, txPointsEarned, txUserId]
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

      <div className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "point_information"}
          onClick={() => setTab("point_information")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "point_information"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Point Infomation
        </button>

        {canManagePoints ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "individual_transaction"}
            onClick={() => setTab("individual_transaction")}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === "individual_transaction"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Individual point transaction
          </button>
        ) : null}

        {canViewPointsTransactions ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all_transactions"}
            onClick={() => setTab("all_transactions")}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === "all_transactions"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Point transactions (all)
          </button>
        ) : null}
      </div>

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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Member
                </label>
                <select
                  value={txUserId}
                  onChange={(e) => setTxUserId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                  required
                  disabled={!canManagePoints || usersWithPoints.length === 0}
                >
                  {usersWithPoints.length === 0 ? (
                    <option value="">No users with points</option>
                  ) : null}
                  {usersWithPoints.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {(u.first_name ?? "")?.trim()} {(u.last_name ?? "")?.trim()} {"·"} {u.total_points ?? 0} pts
                    </option>
                  ))}
                </select>
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
                <input
                  type="number"
                  step={1}
                  value={txPointsEarned}
                  onChange={(e) => setTxPointsEarned(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                  required
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={txBusy || !canManagePoints}
                  className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {txBusy ? "Creating..." : "Create transaction"}
                </button>
              </div>
            </div>

            {usersWithPoints.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                No members currently have points in the leaderboard.
              </div>
            ) : null}
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

