"use server";

import { createClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { getStripeClient } from "@/lib/stripe/client";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import type {
  ManualPaymentPlan,
  Payment,
  PaymentStatus,
  PaymentWithUser,
  StalePendingPayment,
  StripeReconciliationPreview,
  UnmatchedStripePayment,
} from "@/lib/types/membership";
import { revalidatePath } from "next/cache";
import { getSiteUrl } from "@/lib/site-url";
import {
  sendAttendanceInviteEmail,
  sendReinviteEmail,
} from "@/lib/email/invites";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function requireManageMemberships(): Promise<
  | { ok: true; supabase: ServerSupabaseClient }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_memberships")) {
    return { ok: false, error: "You do not have permission to manage memberships." };
  }
  return { ok: true, supabase };
}

const SERVICE_ROLE_ERROR =
  "SUPABASE_SERVICE_ROLE_KEY is not set on the server. The Payments tab needs the service role key to look up members by id.";

// ---------------------------------------------------------------------------
// Payments table
// ---------------------------------------------------------------------------

export async function getPayments(): Promise<{
  data: PaymentWithUser[];
  error: string | null;
}> {
  const gate = await requireManageMemberships();
  if (!gate.ok) return { data: [], error: gate.error };

  const { data: payments, error } = await gate.supabase
    .from("payments")
    .select(
      "id, user_id, stripe_payment_intent_id, status, payment_type, amount, currency, membership_id, plan_id, stripe_customer_id, stripe_checkout_session_id, created_at"
    )
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  if (!payments?.length) return { data: [], error: null };

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const userIds = [...new Set(payments.map((p) => p.user_id))];
  const planIds = [...new Set(payments.map((p) => p.plan_id).filter(Boolean))] as string[];

  const [usersRes, plansRes] = await Promise.all([
    admin.from("users").select("id, first_name, last_name, email").in("id", userIds),
    planIds.length
      ? admin.from("membership_plans").select("id, name").in("id", planIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);
  if (usersRes.error) return { data: [], error: usersRes.error.message };
  if (plansRes.error) return { data: [], error: plansRes.error.message };

  const usersById = new Map((usersRes.data ?? []).map((u) => [u.id as string, u]));
  const plansById = new Map((plansRes.data ?? []).map((p) => [p.id as string, p]));

  const data: PaymentWithUser[] = payments.map((p) => {
    const u = usersById.get(p.user_id);
    return {
      ...(p as Payment),
      first_name: u?.first_name ?? null,
      last_name: u?.last_name ?? null,
      email: u?.email ?? null,
      plan_name: p.plan_id ? plansById.get(p.plan_id)?.name ?? null : null,
    };
  });

  return { data, error: null };
}

/** Member row for the "assign to a member" picker on an unmatched Stripe payment. */
export type MemberSearchResult = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

function escapeIlike(value: string): string {
  return `%${value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

/** Fuzzy search on `public.users` for the unmatched-payment member picker. */
export async function searchMembersForPaymentMatch(
  query: string
): Promise<{ data: MemberSearchResult[]; error: string | null }> {
  const gate = await requireManageMemberships();
  if (!gate.ok) return { data: [], error: gate.error };

  const q = query.trim();
  if (q.length < 1) return { data: [], error: null };
  if (q.length > 200) return { data: [], error: "Search is too long." };

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const pattern = escapeIlike(q);
  const sel = "id, first_name, last_name, email";
  const limit = 20;

  const [em, fn, ln] = await Promise.all([
    admin.from("users").select(sel).ilike("email", pattern).limit(limit),
    admin.from("users").select(sel).ilike("first_name", pattern).limit(limit),
    admin.from("users").select(sel).ilike("last_name", pattern).limit(limit),
  ]);

  const err = em.error?.message || fn.error?.message || ln.error?.message;
  if (err) return { data: [], error: err };

  const merged = new Map<string, MemberSearchResult>();
  for (const rows of [em.data, fn.data, ln.data]) {
    for (const r of (rows ?? []) as MemberSearchResult[]) {
      if (r?.id) merged.set(r.id, r);
    }
  }
  return { data: [...merged.values()].slice(0, 25), error: null };
}

// ---------------------------------------------------------------------------
// Manual payment entry (manage_payments)
// ---------------------------------------------------------------------------

/**
 * Separate from manage_memberships: recording money is a narrower, admin-only
 * act than editing membership records, and manage_payments already exists as
 * the write gate on public.payments.
 */
async function requireManagePayments(): Promise<
  | { ok: true; supabase: ServerSupabaseClient; actorId: string | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_payments")) {
    return { ok: false, error: "You do not have permission to record payments." };
  }
  return { ok: true, supabase, actorId: await getCurrentAppUserId(supabase) };
}

/** Active plans for the "add payment" picker, cheapest field set. */
export async function getPlansForManualPayment(): Promise<{
  data: ManualPaymentPlan[];
  error: string | null;
}> {
  const gate = await requireManagePayments();
  if (!gate.ok) return { data: [], error: gate.error };

  const { data, error } = await gate.supabase
    .from("membership_plans")
    .select("id, name, kind, amount_cents")
    .eq("is_active", true)
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ManualPaymentPlan[], error: null };
}

/**
 * Records a payment collected outside the app's checkout, plus the membership
 * it buys. All the real work is in the record_manual_payment SQL function, so
 * the payment and the membership land in one transaction and cannot half-apply
 * - and so the "already a member" and period-derivation rules live next to the
 * data rather than being re-checked here.
 *
 * This writes nothing to Stripe. The money has already moved; duplicating it
 * as a fresh Stripe object would either double-charge the member or invent a
 * record that never reconciles against the real deposit.
 */
export async function recordManualPayment(input: {
  userId: string;
  planId: string;
  amountCents: number;
  currency?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
}): Promise<{ error: string | null }> {
  const gate = await requireManagePayments();
  if (!gate.ok) return { error: gate.error };

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR };

  const { error } = await admin.rpc("record_manual_payment", {
    p_user_id: input.userId,
    p_plan_id: input.planId,
    p_amount_cents: Math.round(input.amountCents),
    p_currency: input.currency ?? "usd",
    p_stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
    p_stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
    p_actor_id: gate.actorId,
  });

  if (error) {
    // The unique indexes on the Stripe ids are what stop the same payment
    // being entered twice; say so in words rather than leaking the index name.
    if (error.code === "23505") {
      return { error: "That Stripe payment has already been recorded." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/memberships");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Stripe reconciliation (backfill)
// ---------------------------------------------------------------------------

const MAX_SESSIONS_SCANNED = 1000;

function derivePaymentStatus(session: Stripe.Checkout.Session): PaymentStatus | null {
  if (session.status === "complete" && session.payment_status === "paid") return "succeeded";
  // The webhook only reacts to checkout.session.completed - an expired
  // session (abandoned checkout) never gets a status update today, so it
  // sits at "pending" forever unless reconciled here.
  if (session.status === "expired") return "failed";
  return null;
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (!session.payment_intent) return null;
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent.id;
}

/**
 * Scans Stripe Checkout Sessions tagged for membership dues
 * (metadata.finance_account_type === "stripe_memberships", the same
 * convention the webhook and checkout creation use) and diffs them against
 * public.payments: sessions whose row is stuck "pending" while Stripe shows
 * it resolved, and completed sessions with no payments row at all. Read-only
 * - nothing is written until applyStalePendingUpdates / resolveUnmatchedPayment.
 */
export async function previewStripeReconciliation(): Promise<{
  data: StripeReconciliationPreview | null;
  error: string | null;
}> {
  const gate = await requireManageMemberships();
  if (!gate.ok) return { data: null, error: gate.error };

  const stripe = getStripeClient();
  if (!stripe) return { data: null, error: "Stripe is not configured." };

  const { data: existing, error: existingError } = await gate.supabase
    .from("payments")
    .select("id, status, stripe_checkout_session_id");
  if (existingError) return { data: null, error: existingError.message };

  const bySessionId = new Map(
    (existing ?? [])
      .filter((p) => p.stripe_checkout_session_id)
      .map((p) => [p.stripe_checkout_session_id as string, p])
  );

  const stalePending: StalePendingPayment[] = [];
  const unmatched: UnmatchedStripePayment[] = [];
  let sessionsScanned = 0;
  let scanCapped = false;
  let startingAfter: string | undefined;

  try {
    while (sessionsScanned < MAX_SESSIONS_SCANNED) {
      const page = await stripe.checkout.sessions.list({
        limit: 100,
        starting_after: startingAfter,
      });

      for (const session of page.data) {
        sessionsScanned++;
        if (session.metadata?.finance_account_type !== "stripe_memberships") continue;

        const match = bySessionId.get(session.id);
        if (match) {
          if (match.status !== "pending") continue;
          const newStatus = derivePaymentStatus(session);
          if (!newStatus) continue;
          stalePending.push({
            paymentId: match.id,
            stripeCheckoutSessionId: session.id,
            currentStatus: "pending",
            newStatus,
            userEmail: session.customer_details?.email ?? null,
            amount: session.amount_total,
            currency: session.currency ?? "usd",
            createdAt: new Date(session.created * 1000).toISOString(),
          });
          continue;
        }

        if (session.status !== "complete" || session.payment_status !== "paid") continue;
        unmatched.push({
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId(session),
          amount: session.amount_total,
          currency: session.currency ?? "usd",
          customerEmail: session.customer_details?.email ?? null,
          metadataUserId: session.metadata?.user_id ?? null,
          createdAt: new Date(session.created * 1000).toISOString(),
        });
      }

      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    if (sessionsScanned >= MAX_SESSIONS_SCANNED) scanCapped = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to scan Stripe.";
    return { data: null, error: message };
  }

  return {
    data: { stalePending, unmatched, sessionsScanned, scanCapped },
    error: null,
  };
}

/** Applies the status corrections found by previewStripeReconciliation. */
export async function applyStalePendingUpdates(
  updates: { paymentId: string; newStatus: PaymentStatus }[]
): Promise<{ updated: number; error: string | null }> {
  const gate = await requireManageMemberships();
  if (!gate.ok) return { updated: 0, error: gate.error };

  let updated = 0;
  for (const u of updates) {
    // Guard on status = pending so this can't clobber a status the live
    // webhook already corrected in the meantime.
    const { error, count } = await gate.supabase
      .from("payments")
      .update({ status: u.newStatus }, { count: "exact" })
      .eq("id", u.paymentId)
      .eq("status", "pending");
    if (error) return { updated, error: error.message };
    updated += count ?? 0;
  }

  revalidatePath("/dashboard/memberships");
  return { updated, error: null };
}

/**
 * Turns a manually-matched unmatched Stripe session into a real payments
 * row. Re-fetches the session from Stripe rather than trusting whatever the
 * client last saw, since this is the step that actually creates a financial
 * record.
 */
export async function resolveUnmatchedPayment(
  sessionId: string,
  userId: string
): Promise<{ error: string | null }> {
  const gate = await requireManageMemberships();
  if (!gate.ok) return { error: gate.error };

  const stripe = getStripeClient();
  if (!stripe) return { error: "Stripe is not configured." };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not fetch the Stripe session." };
  }

  if (session.metadata?.finance_account_type !== "stripe_memberships") {
    return { error: "This session is not tagged as a membership payment." };
  }
  if (session.status !== "complete" || session.payment_status !== "paid") {
    return { error: "This session has not completed payment on Stripe." };
  }

  const { data: alreadyLinked } = await gate.supabase
    .from("payments")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  if (alreadyLinked) return { error: "This payment already has a row." };

  const planId = session.metadata?.plan_id || null;
  let paymentType: string | null = null;
  if (planId) {
    const { data: plan } = await gate.supabase
      .from("membership_plans")
      .select("kind")
      .eq("id", planId)
      .maybeSingle();
    paymentType = plan?.kind ?? null;
  }

  const { error: insertError } = await gate.supabase.from("payments").insert({
    user_id: userId,
    plan_id: planId,
    status: "succeeded",
    payment_type: paymentType,
    amount: session.amount_total,
    currency: session.currency ?? "usd",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId(session),
    stripe_customer_id:
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath("/dashboard/memberships");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Sign-in accounts (manage_accounts)
// ---------------------------------------------------------------------------

/**
 * One row of the Accounts tab: an auth account, not a member record. The two
 * are not the same set - an account that never finished verification has no
 * business in the members table yet, and a member imported from the old system
 * may have no account at all - which is the whole reason this tab exists.
 */
export type AuthAccountRow = {
  authId: string;
  email: string | null;
  verified: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  memberName: string | null;
  lastInvitedAt: string | null;
};

/**
 * Separate from manage_memberships: marking an email verified bypasses the
 * ownership proof the OTP flow asks for, so it is gated on its own permission
 * rather than on the one that edits member and payment rows.
 */
async function requireManageAccounts(): Promise<
  | { ok: true; supabase: ServerSupabaseClient }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_accounts")) {
    return { ok: false, error: "You do not have permission to manage accounts." };
  }
  return { ok: true, supabase };
}

const ACCOUNTS_SERVICE_ROLE_ERROR =
  "SUPABASE_SERVICE_ROLE_KEY is not set on the server. The Accounts tab needs the service role key to read sign-in accounts.";

/**
 * Unverified first, then newest: the accounts that need an officer to look at
 * them are the ones stuck unverified, so they should not be buried under a
 * hundred healthy rows.
 */
function sortAccounts(rows: AuthAccountRow[]): AuthAccountRow[] {
  return rows.sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function getAuthAccounts(): Promise<{
  data: AuthAccountRow[];
  error: string | null;
}> {
  const gate = await requireManageAccounts();
  if (!gate.ok) return { data: [], error: gate.error };

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: ACCOUNTS_SERVICE_ROLE_ERROR };

  const { users: authUsers, error: listError } = await listAllAuthUsers(admin);
  if (listError) return { data: [], error: listError };

  const accounts: AuthAccountRow[] = authUsers.map((user) => ({
    authId: user.id,
    email: user.email,
    verified: Boolean(user.emailConfirmedAt),
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
    memberName: null,
    lastInvitedAt: null,
  }));

  // Names come from the member record, linked by auth_id. A missing row is
  // normal (unverified signup, or a Dashboard invite nobody accepted), so this
  // fills in what it can and leaves the rest null rather than dropping rows.
  const { data: members, error: membersError } = await gate.supabase
    .from("users")
    .select("auth_id, first_name, last_name")
    .not("auth_id", "is", null);
  if (membersError) return { data: [], error: membersError.message };

  const nameByAuthId = new Map<string, string>();
  for (const member of members ?? []) {
    const name = [member.first_name, member.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (member.auth_id && name) nameByAuthId.set(member.auth_id, name);
  }

  const invitedAt = await lastInviteByEmail(
    admin,
    accounts.map((account) => account.email)
  );

  for (const account of accounts) {
    account.memberName = nameByAuthId.get(account.authId) ?? null;
    account.lastInvitedAt = account.email
      ? invitedAt.get(account.email.toLowerCase()) ?? null
      : null;
  }

  return { data: sortAccounts(accounts), error: null };
}

/**
 * Marks an account's email verified by hand. The normal route is the member
 * entering a code we mailed them - this is the escape hatch for when that
 * cannot happen (a dead address, a mailer outage), so it is deliberately a
 * per-account action with no bulk form behind it.
 */
export async function markAccountVerified(
  authId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireManageAccounts();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = getServiceRoleClient();
  if (!admin) return { ok: false, error: ACCOUNTS_SERVICE_ROLE_ERROR };

  const { error } = await admin.auth.admin.updateUserById(authId, {
    email_confirm: true,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/memberships");
  return { ok: true };
}

/**
 * listUsers is paginated and has no "all" mode. Ten pages is ~2000 accounts,
 * far past the ~390 the club has; stopping there keeps a runaway loop off the
 * request path if the API ever stops reporting a short final page.
 */
type AuthUserSummary = {
  id: string;
  email: string | null;
  emailConfirmedAt: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

async function listAllAuthUsers(
  admin: SupabaseClient
): Promise<{ users: AuthUserSummary[]; error: string | null }> {
  const users: AuthUserSummary[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return { users: [], error: error.message };
    for (const user of data.users) {
      users.push({
        id: user.id,
        email: user.email ?? null,
        emailConfirmedAt: user.email_confirmed_at ?? null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < 200) break;
  }
  return { users, error: null };
}

/** Most recent send per address, lowercased, for the "last invited" columns. */
async function lastInviteByEmail(
  admin: SupabaseClient,
  emails: (string | null)[]
): Promise<Map<string, string>> {
  const wanted = new Set(
    emails
      .filter((email): email is string => Boolean(email))
      .map((email) => email.toLowerCase())
  );
  if (wanted.size === 0) return new Map();

  const { data } = await admin
    .from("invite_sends")
    .select("email, sent_at")
    .order("sent_at", { ascending: false });

  const latest = new Map<string, string>();
  for (const row of data ?? []) {
    const key = (row.email as string).toLowerCase();
    // Rows arrive newest-first, so the first hit per address is the latest.
    if (wanted.has(key) && !latest.has(key)) {
      latest.set(key, row.sent_at as string);
    }
  }
  return latest;
}

async function recordInviteSend(
  admin: SupabaseClient,
  email: string,
  kind: "reinvite" | "attendance_invite",
  sentBy: string | null
): Promise<void> {
  const { error } = await admin
    .from("invite_sends")
    .insert({ email: email.toLowerCase(), kind, sent_by: sentBy });
  // The email has already gone out. Failing the action here would tell the
  // officer it did not send and invite a duplicate, so log and move on.
  if (error) console.error(`Could not record invite send: ${error.message}`);
}

/**
 * Re-invites an account that exists but was never verified. The email points
 * at the password reset flow, which mails a code and confirms the address on
 * completion - so finishing it both sets a password and clears the unverified
 * state that was blocking sign-in.
 */
export async function sendAccountReinvite(
  authId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireManageAccounts();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = getServiceRoleClient();
  if (!admin) return { ok: false, error: ACCOUNTS_SERVICE_ROLE_ERROR };

  const { data: userData, error: getUserError } =
    await admin.auth.admin.getUserById(authId);
  const email = userData?.user?.email;
  if (getUserError || !email) {
    return { ok: false, error: getUserError?.message ?? "Account not found." };
  }
  if (userData.user.email_confirmed_at) {
    return { ok: false, error: "That account is already verified." };
  }

  const { data: member } = await admin
    .from("users")
    .select("first_name")
    .eq("auth_id", authId)
    .maybeSingle();

  const { error: sendError } = await sendReinviteEmail({
    firstName: (member?.first_name as string | null) ?? null,
    email,
    siteUrl: getSiteUrl(),
  });
  if (sendError) return { ok: false, error: sendError };

  await recordInviteSend(
    admin,
    email,
    "reinvite",
    await getCurrentAppUserId(gate.supabase)
  );
  revalidatePath("/dashboard/memberships");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Event contacts with no account (manage_accounts)
// ---------------------------------------------------------------------------

/**
 * Someone who signed in at an event but has no account. One row per address
 * rather than per attendance record - the same person turns up at several
 * events and should only ever be invited once.
 */
export type InvitableContact = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  lastAttendedAt: string | null;
  lastInvitedAt: string | null;
};

export async function getInvitableContacts(): Promise<{
  data: InvitableContact[];
  error: string | null;
}> {
  const gate = await requireManageAccounts();
  if (!gate.ok) return { data: [], error: gate.error };

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: ACCOUNTS_SERVICE_ROLE_ERROR };

  const { data: rows, error } = await admin
    .from("unassigned_attendance")
    .select("first_name, last_name, personal_email, cougarnet_email, attended_at")
    .order("attended_at", { ascending: false });
  if (error) return { data: [], error: error.message };

  // Cougarnet wins when both are present: it is the address the club actually
  // reaches people on, and the one their account is most likely to use.
  const byEmail = new Map<string, InvitableContact>();
  for (const row of rows ?? []) {
    const raw =
      (row.cougarnet_email as string | null)?.trim() ||
      (row.personal_email as string | null)?.trim();
    if (!raw) continue;
    const email = raw.toLowerCase();
    // Rows arrive newest-first, so the first hit per address is the most
    // recent sighting and the freshest spelling of their name.
    if (byEmail.has(email)) continue;
    byEmail.set(email, {
      email,
      firstName: (row.first_name as string | null) ?? null,
      lastName: (row.last_name as string | null) ?? null,
      lastAttendedAt: (row.attended_at as string | null) ?? null,
      lastInvitedAt: null,
    });
  }

  // is_user on the attendance row is a snapshot from check-in time and goes
  // stale the moment someone signs up, so the account list is the authority on
  // who still needs an invite.
  const { users: authUsers, error: listError } = await listAllAuthUsers(admin);
  if (listError) return { data: [], error: listError };
  for (const user of authUsers) {
    if (user.email) byEmail.delete(user.email.toLowerCase());
  }

  const contacts = [...byEmail.values()];
  const invitedAt = await lastInviteByEmail(
    admin,
    contacts.map((contact) => contact.email)
  );
  for (const contact of contacts) {
    contact.lastInvitedAt = invitedAt.get(contact.email) ?? null;
  }

  // Never-invited first, then most recently seen: the people worth chasing.
  contacts.sort((a, b) => {
    if (Boolean(a.lastInvitedAt) !== Boolean(b.lastInvitedAt)) {
      return a.lastInvitedAt ? 1 : -1;
    }
    return (b.lastAttendedAt ?? "").localeCompare(a.lastAttendedAt ?? "");
  });
  return { data: contacts, error: null };
}

export async function sendAttendanceInvite(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireManageAccounts();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = getServiceRoleClient();
  if (!admin) return { ok: false, error: ACCOUNTS_SERVICE_ROLE_ERROR };

  // Re-derived rather than trusted from the client: the caller could name any
  // address, and this one has to be a contact we actually hold and that still
  // has no account.
  const { data: contacts, error } = await getInvitableContacts();
  if (error) return { ok: false, error };
  const contact = contacts.find((c) => c.email === email.trim().toLowerCase());
  if (!contact) {
    return { ok: false, error: "That address is not an invitable contact." };
  }

  const { error: sendError } = await sendAttendanceInviteEmail({
    firstName: contact.firstName,
    email: contact.email,
    siteUrl: getSiteUrl(),
  });
  if (sendError) return { ok: false, error: sendError };

  await recordInviteSend(
    admin,
    contact.email,
    "attendance_invite",
    await getCurrentAppUserId(gate.supabase)
  );
  revalidatePath("/dashboard/memberships");
  return { ok: true };
}
