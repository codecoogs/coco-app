import { getStripeClient } from "@/lib/stripe/client";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const runtime = "nodejs";

const UNIQUE_VIOLATION = "23505";

/**
 * Stripe webhook: ingests membership dues and sponsor payments into finance_transactions.
 *
 * Checkout Sessions / Payment Links must be created with
 * metadata.finance_account_type set to "stripe_memberships" or "stripe_sponsors"
 * (matching public.finance_accounts.type) so this handler knows which account
 * to attribute the payment to. Optionally set metadata.member_id
 * (public.users.id), metadata.sponsor_id (public.finance_sponsors.id), or
 * metadata.category_id (public.finance_categories.id) to enrich the row;
 * uncategorized/unlinked payments can still be edited later from the
 * manage-finances UI.
 *
 * Every event is recorded in finance_stripe_sync_log first (unique on
 * stripe_event_id) so redelivery is a safe no-op, and so failed ingestion
 * can be diagnosed/replayed from the stored payload.
 */
export async function POST(req: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  const admin = getServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server misconfigured: missing service role key." },
      { status: 500 }
    );
  }

  const { error: logError } = await admin.from("finance_stripe_sync_log").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  if (logError) {
    if (logError.code === UNIQUE_VIOLATION) {
      // Already processed this event id.
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  if (event.type === "checkout.session.completed") {
    await ingestCheckoutSession(admin, event.data.object as Stripe.Checkout.Session);
  }

  return NextResponse.json({ received: true });
}

async function ingestCheckoutSession(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  session: Stripe.Checkout.Session
) {
  const accountType = session.metadata?.finance_account_type;
  if (accountType !== "stripe_memberships" && accountType !== "stripe_sponsors") {
    console.warn(
      `Stripe checkout.session.completed (${session.id}) is missing a recognized metadata.finance_account_type; skipping ledger ingestion.`
    );
    return;
  }

  const { data: account } = await admin
    .from("finance_accounts")
    .select("id")
    .eq("type", accountType)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!account?.id) {
    console.warn(
      `No active finance_accounts row of type "${accountType}" found for checkout session ${session.id}; skipping ledger ingestion.`
    );
    return;
  }

  const amountCents = session.amount_total;
  if (amountCents === null || amountCents <= 0) {
    console.warn(`Checkout session ${session.id} has no positive amount_total; skipping.`);
    return;
  }

  const { error: insertError } = await admin.from("finance_transactions").insert({
    account_id: account.id,
    category_id: session.metadata?.category_id ?? null,
    direction: "income",
    amount_cents: amountCents,
    currency: session.currency ?? "usd",
    description: session.metadata?.description ?? null,
    occurred_at: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    member_id: session.metadata?.member_id ?? null,
    sponsor_id: session.metadata?.sponsor_id ?? null,
    source: "stripe",
    stripe_object_id: session.id,
    status: "verified",
  });

  if (insertError && insertError.code !== UNIQUE_VIOLATION) {
    // Not re-thrown: the raw event is already durably logged in
    // finance_stripe_sync_log above and can be reprocessed manually.
    console.error(`Failed to ingest checkout session ${session.id} into finance_transactions:`, insertError);
  }
}
