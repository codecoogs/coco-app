"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { getStripeClient } from "@/lib/stripe/client";
import { getSiteUrl } from "@/lib/site-url";
import type {
  MembershipPlanKind,
  MembershipPlanWithPeriod,
  MembershipWithPlan,
} from "@/lib/types/membership";
import crypto from "node:crypto";

export async function getMembershipPlans(): Promise<{
  data: MembershipPlanWithPeriod[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_plans")
    .select(
      "id, name, kind, stripe_price_id, amount_cents, semester_id, academic_year_id, is_active, created_at, updated_at"
    )
    .eq("is_active", true);
  if (error) return { data: [], error: error.message };
  if (!data?.length) return { data: [], error: null };

  const semesterIds = [...new Set(data.map((p) => p.semester_id).filter(Boolean))] as string[];
  const academicYearIds = [
    ...new Set(data.map((p) => p.academic_year_id).filter(Boolean)),
  ] as string[];

  const [{ data: semesters }, { data: academicYears }] = await Promise.all([
    semesterIds.length
      ? supabase.from("semesters").select("id, label, start_date, end_date").in("id", semesterIds)
      : Promise.resolve({ data: [] as { id: string; label: string; start_date: string; end_date: string }[] }),
    academicYearIds.length
      ? supabase.from("academic_years").select("id, label, start_date, end_date").in("id", academicYearIds)
      : Promise.resolve({ data: [] as { id: string; label: string; start_date: string; end_date: string }[] }),
  ]);

  const semesterMap = new Map((semesters ?? []).map((s) => [s.id, s]));
  const yearMap = new Map((academicYears ?? []).map((y) => [y.id, y]));

  const result: MembershipPlanWithPeriod[] = data.map((p) => {
    const period =
      p.kind === "semester"
        ? semesterMap.get(p.semester_id ?? "")
        : yearMap.get(p.academic_year_id ?? "");
    return {
      ...p,
      period_label: period?.label ?? "Unknown period",
      starts_at: period?.start_date ?? "",
      ends_at: period?.end_date ?? "",
    };
  });

  result.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return { data: result, error: null };
}

export async function getMyMemberships(): Promise<{
  data: MembershipWithPlan[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { data: [], error: "Not signed in." };

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { data: [], error: null };

  const { data, error } = await supabase
    .from("memberships")
    .select("id, user_id, plan_id, status, starts_at, ends_at, payment_id, created_at, updated_at")
    .eq("user_id", appUserId)
    .order("starts_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  if (!data?.length) return { data: [], error: null };

  const planIds = [...new Set(data.map((m) => m.plan_id))];
  const { data: plans } = await supabase
    .from("membership_plans")
    .select("id, name, kind")
    .in("id", planIds);

  const planMap = new Map((plans ?? []).map((p) => [p.id, p]));

  const result: MembershipWithPlan[] = data.map((m) => ({
    ...m,
    plan_name: planMap.get(m.plan_id)?.name ?? "Unknown plan",
    plan_kind: (planMap.get(m.plan_id)?.kind as MembershipPlanKind | undefined) ?? "semester",
  }));

  return { data: result, error: null };
}

export type CreateMembershipCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Creates (or resumes) a Stripe Checkout Session for a membership purchase.
 * metadata.finance_account_type is set so the existing finance-ledger webhook
 * logic (app/api/stripe/webhook) automatically records this as income once
 * paid, in addition to the membership-specific processing in
 * process_stripe_event.
 */
export async function createMembershipCheckoutSession(
  planId: string
): Promise<CreateMembershipCheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { ok: false, error: "No profile row for this user." };

  const stripe = getStripeClient();
  if (!stripe) {
    return { ok: false, error: "Payments are not configured yet. Try again later." };
  }

  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("id, kind, stripe_price_id, amount_cents, is_active")
    .eq("id", planId)
    .maybeSingle();
  if (planError) return { ok: false, error: planError.message };
  if (!plan || !plan.is_active) {
    return { ok: false, error: "This membership plan is not currently available." };
  }

  // Avoid duplicate in-flight purchases for the same plan - resume the
  // existing open session rather than starting a second one.
  const { data: existingPending } = await supabase
    .from("payments")
    .select("stripe_checkout_session_id")
    .eq("user_id", appUserId)
    .eq("plan_id", plan.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPending?.stripe_checkout_session_id) {
    try {
      const existingSession = await stripe.checkout.sessions.retrieve(
        existingPending.stripe_checkout_session_id
      );
      if (existingSession.status === "open" && existingSession.url) {
        return { ok: true, url: existingSession.url };
      }
    } catch {
      // Session no longer retrievable (expired/deleted) - fall through and start a new one.
    }
  }

  const siteUrl = getSiteUrl();
  // Fresh per purchase attempt so a legitimate re-buy after a failed attempt
  // isn't deduped against it by Stripe; only protects against this single
  // call being retried, not cross-request replay (see plan doc Section 3).
  const idempotencyKey = crypto.randomUUID();

  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        success_url: `${siteUrl}/dashboard/membership?membership=success`,
        cancel_url: `${siteUrl}/dashboard/membership?membership=cancelled`,
        metadata: {
          user_id: appUserId,
          plan_id: plan.id,
          finance_account_type: "stripe_memberships",
        },
        // Checkout Session metadata is NOT automatically copied to the
        // PaymentIntent it creates - set it explicitly here too, since
        // payment_intent.payment_failed (no companion checkout.session.*
        // event) needs this to find the right pending payments row.
        payment_intent_data: {
          metadata: {
            user_id: appUserId,
            plan_id: plan.id,
            finance_account_type: "stripe_memberships",
          },
        },
      },
      { idempotencyKey }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start checkout.";
    return { ok: false, error: message };
  }

  if (!session.url) {
    return { ok: false, error: "Stripe did not return a checkout URL." };
  }

  const { error: insertError } = await supabase.from("payments").insert({
    user_id: appUserId,
    plan_id: plan.id,
    status: "pending",
    payment_type: plan.kind,
    amount: plan.amount_cents,
    currency: session.currency ?? "usd",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return { ok: true, url: session.url };
}
