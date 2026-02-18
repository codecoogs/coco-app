"use client";

import {
  getPointCategories,
  getPointTransactionsByEmail,
  getUserPointsByEmail,
} from "@/lib/codecoogs-api";
import type { PointCategory, PointTransaction } from "@/lib/codecoogs-api";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

type PointHistoryContentProps = { email: string };

export function PointHistoryContent({ email }: PointHistoryContentProps) {
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [categories, setCategories] = useState<PointCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getUserPointsByEmail(email),
      getPointTransactionsByEmail(email),
      getPointCategories(),
    ])
      .then(([pointsRes, txRes, catRes]) => {
        if (cancelled) return;
        if (!pointsRes.success || !pointsRes.data) {
          setTotalPoints(0);
        } else {
          setTotalPoints(pointsRes.data.points);
        }
        if (txRes.success && txRes.point_transactions) {
          setTransactions(txRes.point_transactions);
        } else {
          setTransactions([]);
        }
        if (catRes.success && catRes.point_categories) {
          setCategories(catRes.point_categories);
        } else {
          setCategories([]);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load points.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const totalPages = Math.ceil(transactions.length / PAGE_SIZE) || 1;
  const start = (page - 1) * PAGE_SIZE;
  const pageTransactions = transactions.slice(start, start + PAGE_SIZE);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Loading points…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-slate-500">Total points</h2>
        <p className="mt-1 text-3xl font-bold text-slate-900">
          {totalPoints ?? 0}
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Point transactions
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {transactions.length} transaction
            {transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 sm:px-6">
                  Date
                </th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 sm:px-6">
                  Category
                </th>
                <th className="bg-slate-50 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600 sm:px-6">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {pageTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-slate-500 sm:px-6"
                  >
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                pageTransactions.map((tx) => {
                  const cat = categoryMap.get(tx.category_id);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900 sm:px-6">
                        {new Date(tx.created_at).toLocaleDateString(undefined, {
                          dateStyle: "medium",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 sm:px-6">
                        {cat?.name ?? tx.category_id}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-slate-900 sm:px-6">
                        +{tx.points_earned}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {transactions.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-6">
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
