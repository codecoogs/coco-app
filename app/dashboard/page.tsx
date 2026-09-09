import { MemberOverviewCards } from "@/app/dashboard/components/MemberOverviewCards";
import { fetchMemberDashboardOverview } from "@/app/dashboard/member-dashboard-data";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { hasActiveMembership } from "@/lib/supabase/membership";
import { canAccessMemberOnlyFeatures, hasPermission } from "@/lib/types/rbac";
import { ExecutiveDashboard } from "@/app/dashboard/executive/ExecutiveDashboard";
import {
  CheckInResultModal,
  type CheckInOutcome,
} from "@/app/dashboard/components/CheckInResultModal";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const CHECK_IN_OUTCOMES = [
  "ok",
  "already",
  "expired",
  "closed",
  "invalid",
  "error",
] as const;

function parseOutcome(value: string | undefined): CheckInOutcome | null {
  return CHECK_IN_OUTCOMES.includes(value as CheckInOutcome)
    ? (value as CheckInOutcome)
    : null;
}

/** Title for the check-in modal. Read with the service role because a scanner
 *  who just signed up cannot select a non-public event under RLS. */
async function checkInEventTitle(eventId: string | undefined): Promise<string | null> {
  const id = Number(eventId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const admin = getServiceRoleClient();
  if (!admin) return null;
  const { data } = await admin.from("events").select("title").eq("id", id).maybeSingle();
  return (data?.title as string | undefined) ?? null;
}

function softCardTone(seed: string) {
  const accent = `color-mix(in oklab, ${seed} 65%, var(--accent) 35%)`;
  return {
    backgroundColor: `color-mix(in oklab, ${accent} 10%, var(--card) 90%)`,
    borderColor: `color-mix(in oklab, ${accent} 26%, var(--border) 74%)`,
    boxShadow: `inset 0 1px 0 color-mix(in oklab, ${accent} 16%, transparent 84%)`,
  } as const;
}

type Props = {
  searchParams: Promise<{ checkin?: string; event?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const { checkin, event: checkInEventId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profile = await fetchUserProfile(supabase, user.id);

  const outcome = parseOutcome(checkin);
  const checkInModal = outcome ? (
    <CheckInResultModal
      outcome={outcome}
      eventTitle={await checkInEventTitle(checkInEventId)}
      pendingPoints={outcome === "ok" && !(await hasActiveMembership(supabase))}
    />
  ) : null;

  // Rendered here rather than redirect("/dashboard/executive"): a server
  // redirect during render trips React #310 inside Next's own Router, which
  // white-screens above global-error. See ExecutiveDashboard for the detail.
  if (hasPermission(profile, "view_executive_dashboard")) {
    return (
      <>
        {checkInModal}
        <ExecutiveDashboard />
      </>
    );
  }

  const [overview, hasMembership] = await Promise.all([
    fetchMemberDashboardOverview(supabase, { id: user.id, email: user.email }),
    hasActiveMembership(supabase),
  ]);
  const canSeeOpportunities = canAccessMemberOnlyFeatures(profile, hasMembership);
  const accountTone = softCardTone("#22d3ee");

  return (
    <div className="space-y-8">
      {checkInModal}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      </div>

      <MemberOverviewCards overview={overview} canSeeOpportunities={canSeeOpportunities} />

      <section
        className="rounded-xl border bg-card p-6 shadow-sm"
        style={accountTone}
      >
        <h2 className="text-lg font-semibold text-card-foreground">
          Your account
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Email
            </dt>
            <dd className="mt-0.5 text-card-foreground">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Signed in at
            </dt>
            <dd className="mt-0.5 text-card-foreground">
              {user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
