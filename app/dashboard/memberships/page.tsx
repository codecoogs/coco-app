import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { isMembershipCurrent, type MembershipStatus } from "@/lib/types/membership";
import { getAuthAccounts, getPayments, type AuthAccountRow } from "./actions";
import { MembershipsPageContent } from "./MembershipsPageContent";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";

/**
 * One row of the User Management table.
 *
 * Membership, paid, next due and last payment are all derived from Supabase.
 * `users.membership` and `users.paid` are legacy columns that nothing in the
 * app writes any more - they are deliberately NOT read here, so a user counts
 * as paid only when a real membership row says so. The columns themselves are
 * left in place; the historical values are still there if an audit ever needs
 * them.
 */
export type UserPaymentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  major: string | null;
  membership: string | null;
  paid: boolean;
  next_due_date: string;
  last_payment_date: string;
};

/**
 * The legacy import wrote 'completed'; the Stripe pipeline writes 'succeeded'.
 * Both are real, settled payments - filtering on either one alone silently
 * drops the other set.
 */
const PAID_PAYMENT_STATUSES = ["succeeded", "completed"];

const PLAN_KIND_LABEL: Record<string, string> = {
  yearly: "Yearly",
  semester: "Semester",
};

type UserRow = Pick<
  UserPaymentRow,
  "id" | "first_name" | "last_name" | "email" | "major"
>;
type MembershipRow = {
  user_id: string | null;
  status: MembershipStatus | null;
  ends_at: string;
  plan_id: string | null;
};
type PlanRow = { id: string; kind: string | null };
type PaymentRow = { user_id: string | null; created_at: string };

/**
 * Keeps only the highest-sorting row per user. Both memberships and payments
 * need this and neither table is big enough to justify a per-user query.
 */
function latestPerUser<T extends { user_id: string | null }>(
  rows: T[],
  sortValue: (row: T) => string
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of rows) {
    if (!row.user_id) continue;
    const previous = latest.get(row.user_id);
    if (!previous || sortValue(row) > sortValue(previous)) {
      latest.set(row.user_id, row);
    }
  }
  return latest;
}

function buildRows(
  users: UserRow[],
  memberships: MembershipRow[],
  plans: PlanRow[],
  payments: PaymentRow[]
): UserPaymentRow[] {
  const kindByPlanId = new Map(plans.map((plan) => [plan.id, plan.kind]));
  const membershipByUser = latestPerUser(memberships, (m) => m.ends_at);
  const paymentByUser = latestPerUser(payments, (p) => p.created_at);

  return users.map((user) => {
    const membership = membershipByUser.get(user.id);
    const kind = membership?.plan_id
      ? kindByPlanId.get(membership.plan_id)
      : null;

    return {
      ...user,
      membership: kind ? PLAN_KIND_LABEL[kind] ?? kind : null,
      // Status alone isn't enough - an 'active' row whose ends_at has passed is
      // an expired membership nobody has swept yet.
      paid: membership?.status
        ? isMembershipCurrent({
            status: membership.status,
            ends_at: membership.ends_at,
          })
        : false,
      // Empty string rather than null: formatDate already renders "" as an em
      // dash, so blank cells need no extra branch in the table.
      next_due_date: membership?.ends_at ?? "",
      last_payment_date: paymentByUser.get(user.id)?.created_at ?? "",
    };
  });
}

async function fetchUserPaymentRows(
  supabase: SupabaseClient
): Promise<UserPaymentRow[]> {
  // ponytail: PostgREST caps a plain select() at 1000 rows and there are ~390
  // users today. Switch to .range() pagination when the club outgrows that.
  const [usersRes, membershipsRes, plansRes, paymentsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, first_name, last_name, email, major")
      .is("deleted_at", null),
    supabase.from("memberships").select("user_id, status, ends_at, plan_id"),
    supabase.from("membership_plans").select("id, kind"),
    supabase
      .from("payments")
      .select("user_id, created_at")
      .in("status", PAID_PAYMENT_STATUSES),
  ]);

  const failure =
    usersRes.error ??
    membershipsRes.error ??
    plansRes.error ??
    paymentsRes.error;
  if (failure) throw new Error(failure.message);

  return buildRows(
    (usersRes.data ?? []) as UserRow[],
    (membershipsRes.data ?? []) as MembershipRow[],
    (plansRes.data ?? []) as PlanRow[],
    (paymentsRes.data ?? []) as PaymentRow[]
  );
}

export default async function MembershipsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/memberships");
  }

  const profile = await fetchUserProfile(supabase, user.id);
  // Two permissions reach this page: manage_memberships for the member and
  // payment tabs, manage_accounts for the Accounts tab. Either one on its own
  // is enough to get in; the tabs themselves are what each permission gates.
  const canManageMemberships = hasPermission(profile, "manage_memberships");
  const canManageAccounts = hasPermission(profile, "manage_accounts");
  if (!canManageMemberships && !canManageAccounts) {
    redirect("/dashboard");
  }

  let users: UserPaymentRow[] = [];
  let error: string | null = null;

  if (canManageMemberships) {
    try {
      users = await fetchUserPaymentRows(supabase);
    } catch (e) {
      error =
        e instanceof Error ? e.message : "Failed to load users with payment info.";
    }
  }

  const paymentsRes = canManageMemberships
    ? await getPayments()
    : { data: [], error: null };
  const accountsRes: { data: AuthAccountRow[]; error: string | null } =
    canManageAccounts ? await getAuthAccounts() : { data: [], error: null };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          User Management
        </h1>
        <p className="mt-1 text-muted-foreground">
          View all users with payment and due date info. Filter by active
          membership, paid status, and membership type. For officers and admins.
        </p>
        <Link
          href="/dashboard/memberships/plans"
          className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
        >
          Manage membership plans →
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : (
        <MembershipsPageContent
          users={users}
          initialPayments={paymentsRes.data}
          paymentsError={paymentsRes.error}
          accounts={accountsRes.data}
          accountsError={accountsRes.error}
          canManageMemberships={canManageMemberships}
          canManageAccounts={canManageAccounts}
        />
      )}
    </div>
  );
}
