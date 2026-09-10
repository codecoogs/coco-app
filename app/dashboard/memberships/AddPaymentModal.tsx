"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/shadcn/dialog";
import { Button } from "@/app/components/ui/shadcn/button";
import { formatCents } from "@/lib/finance/format";
import type { ManualPaymentPlan } from "@/lib/types/membership";
import { useEffect, useState } from "react";
import {
  getPlansForManualPayment,
  recordManualPayment,
  searchMembersForPaymentMatch,
  type MemberSearchResult,
} from "./actions";

type Props = {
  onClose: () => void;
  onRecorded: () => void;
};

/**
 * Records a membership payment taken outside the app's checkout - an official
 * Stripe link, say - so the member gets the membership the webhook never
 * created for them. Nothing is sent to Stripe: the money already moved, and
 * this only writes the records the app was missing.
 */
export function AddPaymentModal({ onClose, onRecorded }: Props) {
  const [plans, setPlans] = useState<ManualPaymentPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [selected, setSelected] = useState<MemberSearchResult | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getPlansForManualPayment();
      if (cancelled) return;
      if (res.error) setError(res.error);
      else setPlans(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (selected || debounced.length < 1) return;
    let cancelled = false;
    (async () => {
      const res = await searchMembersForPaymentMatch(debounced);
      if (cancelled) return;
      setResults(res.error ? [] : res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, selected]);

  // Prefill the amount from the plan's own price - the common case is that the
  // member paid exactly that, and an operator retyping it is a chance to fat-
  // finger a financial record.
  const choosePlan = (id: string) => {
    setPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) setAmount((plan.amount_cents / 100).toFixed(2));
  };

  const amountCents = Math.round(Number(amount) * 100);
  const canSubmit =
    !!selected &&
    !!planId &&
    Number.isFinite(amountCents) &&
    amountCents > 0 &&
    (sessionId.trim() !== "" || paymentIntentId.trim() !== "") &&
    !saving;

  const handleSubmit = async () => {
    if (!selected || !canSubmit) return;
    setSaving(true);
    setError(null);
    const res = await recordManualPayment({
      userId: selected.id,
      planId,
      amountCents,
      stripeCheckoutSessionId: sessionId.trim() || undefined,
      stripePaymentIntentId: paymentIntentId.trim() || undefined,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onRecorded();
    onClose();
  };

  const field =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add payment</DialogTitle>
          <DialogDescription>
            Record a membership payment collected outside the app. This does not
            charge anyone - it files the payment and grants the membership.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="add-payment-member" className="text-sm font-medium text-foreground">
              Member
            </label>
            {selected ? (
              <div className="mt-1 flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                <span className="text-foreground">
                  {selected.first_name} {selected.last_name}{" "}
                  <span className="text-muted-foreground">({selected.email})</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setQuery("");
                    setResults([]);
                  }}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  id="add-payment-member"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className={`mt-1 ${field}`}
                />
                {results.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-card">
                    {results.map((member) => (
                      <li key={member.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(member)}
                          className="w-full px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted"
                        >
                          {member.first_name} {member.last_name}{" "}
                          <span className="text-muted-foreground">({member.email})</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label htmlFor="add-payment-plan" className="text-sm font-medium text-foreground">
              Plan
            </label>
            <select
              id="add-payment-plan"
              value={planId}
              onChange={(e) => choosePlan(e.target.value)}
              className={`mt-1 ${field}`}
            >
              <option value="">Select a plan…</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatCents(plan.amount_cents)} ({plan.kind})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="add-payment-amount" className="text-sm font-medium text-foreground">
              Amount paid (USD)
            </label>
            <input
              id="add-payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`mt-1 ${field}`}
            />
          </div>

          <div>
            <label htmlFor="add-payment-session" className="text-sm font-medium text-foreground">
              Stripe checkout session id
            </label>
            <input
              id="add-payment-session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="cs_…"
              className={`mt-1 ${field}`}
            />
          </div>

          <div>
            <label htmlFor="add-payment-intent" className="text-sm font-medium text-foreground">
              Stripe payment intent id
            </label>
            <input
              id="add-payment-intent"
              value={paymentIntentId}
              onChange={(e) => setPaymentIntentId(e.target.value)}
              placeholder="pi_…"
              className={`mt-1 ${field}`}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              At least one Stripe id is required, so this payment can be matched
              back to Stripe and cannot be entered twice.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? "Adding…" : "Add payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
