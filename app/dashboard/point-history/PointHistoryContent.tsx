"use client";

import { refreshPointHistory } from "./actions";
import type { PointHistoryBundle } from "./queries";
import { useCallback, useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

type Props = {
  initial: PointHistoryBundle;
};

export function PointHistoryContent({ initial }: Props) {
  const [bundle, setBundle] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setBundle(initial);
  }, [initial]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await refreshPointHistory();
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) setBundle(res.data);
  }, []);

  const categoryMap = useMemo(
    () => new Map(bundle.categories.map((c) => [c.id, c])),
    [bundle.categories]
  );

  const transactions = bundle.transactions;
  const totalPages = Math.ceil(transactions.length / PAGE_SIZE) || 1;
  const start = (page - 1) * PAGE_SIZE;
  const pageTransactions = transactions.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">Total points</h2>
        <p className="mt-1 text-3xl font-bold text-card-foreground">
          {bundle.totalPoints}
        </p>
        {bundle.rank != null && (
          <p className="mt-2 text-sm text-muted-foreground">
            Leaderboard rank #{bundle.rank}
          </p>
        )}
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">
            Point transactions
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {transactions.length} transaction
            {transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                  Date
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                  Category
                </th>
                <th className="bg-muted px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {pageTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                pageTransactions.map((tx) => {
                  const cat = tx.category_id ? categoryMap.get(tx.category_id) : undefined;
                  const pts = tx.points_earned ?? 0;
                  const created = tx.created_at
                    ? new Date(tx.created_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "—";
                  return (
                    <tr key={tx.id} className="hover:bg-muted">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-card-foreground sm:px-6">
                        {created}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                        {cat?.name ?? tx.category_id ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-card-foreground sm:px-6">
                        +{pts}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {transactions.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
