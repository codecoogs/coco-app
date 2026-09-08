"use client";

import { formatCents } from "@/lib/finance/format";
import type { StripeReconciliationPreview } from "@/lib/types/membership";
import { useCallback, useState } from "react";
import { applyStalePendingUpdates, previewStripeReconciliation } from "./actions";
import { UnmatchedPaymentRow } from "./UnmatchedPaymentRow";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

type Props = {
  onReconciled: () => void;
};

/** Read-only scan of Stripe against public.payments - see previewStripeReconciliation. */
export function StripeReconciliationPanel({ onReconciled }: Props) {
  const [preview, setPreview] = useState<StripeReconciliationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setApplyMessage(null);
    const res = await previewStripeReconciliation();
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error ?? "Could not scan Stripe.");
      return;
    }
    setPreview(res.data);
  }, []);

  const handleApplyStale = useCallback(async () => {
    if (!preview?.stalePending.length) return;
    setApplying(true);
    setApplyMessage(null);
    const res = await applyStalePendingUpdates(
      preview.stalePending.map((s) => ({ paymentId: s.paymentId, newStatus: s.newStatus }))
    );
    setApplying(false);
    if (res.error) {
      setApplyMessage(`Error: ${res.error}`);
      return;
    }
    setApplyMessage(`Updated ${res.updated} payment${res.updated === 1 ? "" : "s"}.`);
    setPreview((prev) => (prev ? { ...prev, stalePending: [] } : prev));
    onReconciled();
  }, [preview, onReconciled]);

  const handleUnmatchedResolved = useCallback(
    (sessionId: string) => {
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              unmatched: prev.unmatched.filter((u) => u.stripeCheckoutSessionId !== sessionId),
            }
          : prev
      );
      onReconciled();
    },
    [onReconciled]
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-card-foreground">Reconcile with Stripe</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Finds payments stuck at &quot;pending&quot; that Stripe shows resolved, and
            completed membership charges with no payments row at all.
          </p>
        </div>
        <button
          type="button"
          onClick={handleScan}
          disabled={loading}
          className="shrink-0 rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Scanning…" : "Check Stripe for updates"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {preview && (
        <div className="mt-4 space-y-6">
          <p className="text-xs text-muted-foreground">
            Scanned {preview.sessionsScanned} Stripe checkout session
            {preview.sessionsScanned === 1 ? "" : "s"}
            {preview.scanCapped
              ? " (stopped at the scan limit — run again to continue further back)"
              : ""}
            .
          </p>

          {!preview.stalePending.length && !preview.unmatched.length && (
            <p className="text-sm text-muted-foreground">
              Everything matches what Stripe has on file.
            </p>
          )}

          {preview.stalePending.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-card-foreground">
                  Stuck pending ({preview.stalePending.length})
                </h3>
                <button
                  type="button"
                  onClick={handleApplyStale}
                  disabled={applying}
                  className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {applying ? "Applying…" : "Apply all corrections"}
                </button>
              </div>
              <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead>
                    <tr className="bg-muted text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Pending →</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {preview.stalePending.map((s) => (
                      <tr key={s.paymentId}>
                        <td className="px-3 py-2 text-card-foreground">{s.userEmail ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {s.amount != null ? formatCents(s.amount, s.currency) : "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDate(s.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              s.newStatus === "succeeded"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {s.newStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.unmatched.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">
                No matching row ({preview.unmatched.length})
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Completed on Stripe but not created through this app&apos;s checkout. Pick the
                member each one belongs to.
              </p>
              <div className="mt-2 space-y-2">
                {preview.unmatched.map((u) => (
                  <UnmatchedPaymentRow
                    key={u.stripeCheckoutSessionId}
                    payment={u}
                    onResolved={() => handleUnmatchedResolved(u.stripeCheckoutSessionId)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {applyMessage && <p className="mt-3 text-sm text-muted-foreground">{applyMessage}</p>}
    </div>
  );
}
