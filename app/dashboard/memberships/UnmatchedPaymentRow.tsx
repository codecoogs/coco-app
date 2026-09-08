"use client";

import { formatCents } from "@/lib/finance/format";
import type { UnmatchedStripePayment } from "@/lib/types/membership";
import { useCallback, useEffect, useState } from "react";
import {
  resolveUnmatchedPayment,
  searchMembersForPaymentMatch,
  type MemberSearchResult,
} from "./actions";

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
  payment: UnmatchedStripePayment;
  onResolved: () => void;
};

export function UnmatchedPaymentRow({ payment, onResolved }: Props) {
  const [q, setQ] = useState(payment.customerEmail ?? "");
  const [debounced, setDebounced] = useState(q);
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MemberSearchResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (selected || debounced.length < 1) return;
    let cancelled = false;
    (async () => {
      setSearching(true);
      const res = await searchMembersForPaymentMatch(debounced);
      if (cancelled) return;
      setSearching(false);
      setResults(res.error ? [] : res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, selected]);

  const handleResolve = useCallback(async () => {
    if (!selected) return;
    setResolving(true);
    setError(null);
    const res = await resolveUnmatchedPayment(payment.stripeCheckoutSessionId, selected.id);
    setResolving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onResolved();
  }, [selected, payment.stripeCheckoutSessionId, onResolved]);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-sm">
        <span className="font-medium text-card-foreground">
          {payment.amount != null ? formatCents(payment.amount, payment.currency) : "—"}
        </span>
        <span className="ml-2 text-muted-foreground">
          {payment.customerEmail ?? "no email on file"} · {formatDate(payment.createdAt)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {selected ? (
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-foreground">
            {selected.first_name} {selected.last_name} ({selected.email}){" "}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="ml-1 text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </span>
        ) : (
          <div className="relative">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search member by name or email…"
              className="w-64 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            {debounced.length > 0 && (
              <div className="absolute z-10 mt-1 w-64 rounded-lg border border-border bg-card shadow-lg">
                {searching ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No matches.</p>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelected(r);
                        setQ("");
                      }}
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-muted"
                    >
                      {r.first_name} {r.last_name}
                      <span className="block text-muted-foreground">{r.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleResolve}
          disabled={!selected || resolving}
          className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {resolving ? "Saving…" : "Assign & create payment"}
        </button>
      </div>

      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
