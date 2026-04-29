import type { MemberDashboardOverview } from "@/app/dashboard/member-dashboard-data";
import Link from "next/link";

function formatEventWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

type Props = { overview: MemberDashboardOverview };

function softCardTone(seed: string) {
  const accent = `color-mix(in oklab, ${seed} 65%, var(--accent) 35%)`;
  return {
    backgroundColor: `color-mix(in oklab, ${accent} 10%, var(--card) 90%)`,
    borderColor: `color-mix(in oklab, ${accent} 26%, var(--border) 74%)`,
    boxShadow: `inset 0 1px 0 color-mix(in oklab, ${accent} 16%, transparent 84%)`,
  } as const;
}

export function MemberOverviewCards({ overview }: Props) {
  const {
    hasLinkedProfile,
    pointDataError,
    totalPoints,
    leaderboardRank,
    team,
    eventAttendanceTotal,
    attendanceQueryFailed,
    teamQueryFailed,
    upcomingPublicEvents,
    opportunities,
    eventsFetchError,
    opportunitiesFetchError,
  } = overview;
  const pointsTone = softCardTone("#facc15");
  const teamTone = softCardTone("#60a5fa");
  const attendanceTone = softCardTone("#fb923c");
  const leaderboardTone = softCardTone("#4ade80");
  const upcomingEventsTone = softCardTone("#a78bfa");
  const opportunitiesTone = softCardTone("#f472b6");

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section
          className="rounded-xl border bg-card p-5 shadow-sm"
          style={pointsTone}
        >
          <h2 className="text-sm font-medium text-muted-foreground">
            Total points
          </h2>
          {!hasLinkedProfile ? (
            <p className="mt-2 text-sm text-muted-foreground">
              We don&apos;t have a member profile linked to this account yet.
              Once you&apos;re in the system, your points will show up here.
            </p>
          ) : pointDataError ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Couldn&apos;t load points: {pointDataError}
            </p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-card-foreground">
                {totalPoints}
              </p>
              <Link
                href="/dashboard/point-history"
                className="mt-3 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                View history →
              </Link>
            </>
          )}
        </section>

        <section
          className="rounded-xl border bg-card p-5 shadow-sm"
          style={teamTone}
        >
          <h2 className="text-sm font-medium text-muted-foreground">
            Team assignment
          </h2>
          {!hasLinkedProfile ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Join the roster first — then your team assignment can appear here.
            </p>
          ) : teamQueryFailed ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Couldn&apos;t load team information right now. Try again later.
            </p>
          ) : team ? (
            <div className="mt-2 space-y-1">
              <p className="text-lg font-semibold text-card-foreground">
                {team.name}
              </p>
              {team.team_number > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Team #{team.team_number}
                </p>
              ) : null}
              <Link
                href="/dashboard/events"
                className="inline-block pt-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Calendar & events →
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;re not assigned to a team yet. Officers can place you when
              rosters go out.
            </p>
          )}
        </section>

        <section
          className="rounded-xl border bg-card p-5 shadow-sm"
          style={attendanceTone}
        >
          <h2 className="text-sm font-medium text-muted-foreground">
            Event attendance
          </h2>
          {!hasLinkedProfile ? (
            <p className="mt-2 text-sm text-muted-foreground">
              After your profile is linked, check-ins here will roll up automatically.
            </p>
          ) : attendanceQueryFailed ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Couldn&apos;t load attendance totals right now.
            </p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-card-foreground">
                {eventAttendanceTotal}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {eventAttendanceTotal === 0
                  ? "No recorded attendance yet."
                  : "Total events attended (unique check-ins)"}
              </p>
              <Link
                href="/dashboard/events"
                className="mt-3 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Browse events →
              </Link>
            </>
          )}
        </section>

        <section
          className="rounded-xl border bg-card p-5 shadow-sm"
          style={leaderboardTone}
        >
          <h2 className="text-sm font-medium text-muted-foreground">
            Leaderboard rank
          </h2>
          {!hasLinkedProfile ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Rankings use your member profile — once you&apos;re on the board,
              your place will appear here.
            </p>
          ) : pointDataError ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Couldn&apos;t load leaderboard data.
            </p>
          ) : leaderboardRank == null ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                You&apos;re not on the leaderboard yet — earn points from events and
                activities to climb the ranks.
              </p>
              <Link
                href="/dashboard/leaderboard"
                className="mt-3 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Open leaderboard →
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-card-foreground">
                #{leaderboardRank}
              </p>
              <Link
                href="/dashboard/leaderboard"
                className="mt-3 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                View full board →
              </Link>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className="rounded-xl border bg-card p-6 shadow-sm"
          style={upcomingEventsTone}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">
                Upcoming public events
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Next few events everyone can see
              </p>
            </div>
            <Link
              href="/dashboard/events"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              All events →
            </Link>
          </div>

          {eventsFetchError ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Couldn&apos;t load events: {eventsFetchError}
            </p>
          ) : upcomingPublicEvents.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No upcoming public events scheduled. Check back after new ones are posted.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcomingPublicEvents.map((e) => (
                <li
                  key={e.id}
                  className="border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <p className="font-medium text-card-foreground">{e.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatEventWhen(e.start_time)}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="rounded-xl border bg-card p-6 shadow-sm"
          style={opportunitiesTone}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">
                Opportunities
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ways to get involved off the calendar
              </p>
            </div>
            <Link
              href="/dashboard/opportunities"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Opportunities page →
            </Link>
          </div>

          {opportunitiesFetchError ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Couldn&apos;t load opportunities: {opportunitiesFetchError}
            </p>
          ) : opportunities.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No active opportunities right now — new internships, roles, and
              projects land here first.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {opportunities.map((o) => (
                <li
                  key={o.id}
                  className="border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <a
                    href={o.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-accent hover:underline"
                  >
                    {o.title}
                  </a>
                  {o.category ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {o.category}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
