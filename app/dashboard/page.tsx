import { MemberOverviewCards } from "@/app/dashboard/components/MemberOverviewCards";
import { fetchMemberDashboardOverview } from "@/app/dashboard/member-dashboard-data";
import { createClient } from "@/lib/supabase/server";

function softCardTone(seed: string) {
  const accent = `color-mix(in oklab, ${seed} 65%, var(--accent) 35%)`;
  return {
    backgroundColor: `color-mix(in oklab, ${accent} 10%, var(--card) 90%)`,
    borderColor: `color-mix(in oklab, ${accent} 26%, var(--border) 74%)`,
    boxShadow: `inset 0 1px 0 color-mix(in oklab, ${accent} 16%, transparent 84%)`,
  } as const;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const overview = await fetchMemberDashboardOverview(supabase, {
    id: user.id,
    email: user.email,
  });
  const accountTone = softCardTone("#22d3ee");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Welcome back. Here&apos;s a snapshot of your membership.
        </p>
      </div>

      <MemberOverviewCards overview={overview} />

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
