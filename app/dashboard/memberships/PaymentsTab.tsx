"use client";

import { formatCents } from "@/lib/finance/format";
import type { PaymentStatus, PaymentWithUser } from "@/lib/types/membership";
import { useCallback, useMemo, useState } from "react";
import { getPayments } from "./actions";
import { StripeReconciliationPanel } from "./StripeReconciliationPanel";

const PAGE_SIZE = 20;

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function statusTone(status: string | null) {
  switch (status) {
    case "succeeded":
      return "text-emerald-600 dark:text-emerald-400";
    case "failed":
      return "text-red-600 dark:text-red-400";
    case "refunded":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

type Props = { initialPayments: PaymentWithUser[]; initialError?: string | null };

export function PaymentsTab({ initialPayments, initialError = null }: Props) {
  const [payments, setPayments] = useState(initialPayments);
  const [loadError, setLoadError] = useState(initialError);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    const res = await getPayments();
    setLoadError(res.error);
    if (!res.error) setPayments(res.data);
  }, []);

  const filtered = useMemo(() => {
    let list = payments;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase();
        return (
          name.includes(q) ||
          (p.email ?? "").toLowerCase().includes(q) ||
          (p.stripe_checkout_session_id ?? "").toLowerCase().includes(q) ||
          (p.stripe_payment_intent_id ?? "").toLowerCase().includes(q)
        );
      });
    }
    if (statusFilter) list = list.filter((p) => p.status === statusFilter);
    return list;
  }, [payments, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pagePayments = filtered.slice(start, start + PAGE_SIZE);

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(payments.map((p) => p.status).filter((s): s is PaymentStatus => Boolean(s)))
      ).sort(),
    [payments]
  );

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {loadError}
        </div>
      )}

      <StripeReconciliationPanel onReconciled={refresh} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Search by name, email, or Stripe id…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">Stripe payments</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtered.length} of {payments.length} payment{payments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Member
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Plan
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Amount
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Status
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Created
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Stripe session
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {pagePayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground sm:px-6">
                    No payments match the current filters.
                  </td>
                </tr>
              ) : (
                pagePayments.map((p) => (
                  <tr key={p.id} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                      {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}
                      <div className="text-xs font-normal text-muted-foreground">{p.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {p.plan_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {p.amount != null ? formatCents(p.amount, p.currency) : "—"}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-sm sm:px-6 ${statusTone(p.status)}`}
                    >
                      {p.status ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDateTime(p.created_at)}
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-3 text-xs text-muted-foreground sm:px-6">
                      {p.stripe_checkout_session_id ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
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
