"use client";

import { formatCents } from "@/lib/finance/format";
import type { MembershipPlanWithPeriod, MembershipWithPlan } from "@/lib/types/membership";
import { isMembershipCurrent } from "@/lib/types/membership";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { createMembershipCheckoutSession } from "./actions";

type Props = {
  initialPlans: MembershipPlanWithPeriod[];
  initialMemberships: MembershipWithPlan[];
};

/**
 * Formats a plain YYYY-MM-DD calendar date without going through a Date's
 * timezone conversion - `new Date("2026-08-20")` parses as UTC midnight,
 * which rolls back a day once formatted in any timezone behind UTC.
 */
function formatDate(d: string): string {
  const [year, month, day] = d.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function MembershipSection({ initialPlans, initialMemberships }: Props) {
  const searchParams = useSearchParams();
  const redirectStatus = searchParams.get("membership");

  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentMembership = useMemo(
    () => initialMemberships.find(isMembershipCurrent) ?? initialMemberships[0] ?? null,
    [initialMemberships]
  );

  const hasCurrentMembership = currentMembership ? isMembershipCurrent(currentMembership) : false;

  async function handleBuy(planId: string) {
    setError(null);
    setBusyPlanId(planId);
    const res = await createMembershipCheckoutSession(planId);
    if (!res.ok) {
      setError(res.error);
      setBusyPlanId(null);
      return;
    }
    window.location.assign(res.url);
  }

  return (
    <div className="space-y-6">
      {redirectStatus === "success" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-300">
          Payment received — it may take a moment to finish processing.
        </p>
      )}
      {redirectStatus === "cancelled" && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Checkout was cancelled — no charge was made.
        </p>
      )}

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">Current status</p>
        {currentMembership ? (
          <p className="mt-1 text-card-foreground">
            <span className="font-medium">{currentMembership.plan_name}</span>
            {" — "}
            <span className={hasCurrentMembership ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>
              {hasCurrentMembership ? "Active" : currentMembership.status}
            </span>
            {" · "}
            {hasCurrentMembership ? "expires" : "ended"} {formatDate(currentMembership.ends_at)}
          </p>
        ) : (
          <p className="mt-1 text-card-foreground">No membership yet.</p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid sm:grid-cols-[minmax(0,220px)_1fr]">
          <div className="flex items-center justify-center bg-muted/40 p-8 sm:p-6">
            <Image
              src="/images/icons/coco-nice.png"
              alt=""
              width={400}
              height={400}
              className="h-auto w-32 max-w-[180px] object-contain sm:w-full"
              priority
            />
          </div>

          <div className="p-6 sm:p-8">
            <h2 className="text-xl font-bold text-card-foreground">CodeCoogs membership</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Join or renew to get full access to CodeCoogs events, points, and perks.
            </p>

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="mt-5 space-y-3">
              {initialPlans.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No membership plans are available for purchase right now.
                </p>
              )}
              {initialPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div>
                    <p className="font-medium text-card-foreground">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCents(plan.amount_cents)} · {formatDate(plan.starts_at)} – {formatDate(plan.ends_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBuy(plan.id)}
                    disabled={busyPlanId !== null}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyPlanId === plan.id ? "Redirecting…" : "Buy"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
