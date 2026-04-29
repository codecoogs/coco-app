import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchPointHistoryForSignedInUser,
  getLinkedAppUserIds,
} from "@/app/dashboard/point-history/server-queries";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UpcomingPublicEventRow = {
  id: number;
  title: string;
  start_time: string | null;
  location: string | null;
};

export type ActiveOpportunityRow = {
  id: string;
  title: string;
  category: string | null;
  link_url: string;
};

export type MemberTeamSummary = {
  id: string;
  name: string;
  team_number: number;
};

export type MemberDashboardOverview = {
  /** Point history / leaderboard load error (optional message) */
  pointDataError: string | null;
  hasLinkedProfile: boolean;
  totalPoints: number;
  leaderboardRank: number | null;
  team: MemberTeamSummary | null;
  eventAttendanceTotal: number;
  attendanceQueryFailed: boolean;
  teamQueryFailed: boolean;
  upcomingPublicEvents: UpcomingPublicEventRow[];
  opportunities: ActiveOpportunityRow[];
  /** When set, listings could not be loaded (distinct from empty list). */
  eventsFetchError: string | null;
  opportunitiesFetchError: string | null;
};

async function fetchTeamAndAttendanceCounts(
  userIds: string[]
): Promise<{
  team: MemberTeamSummary | null;
  attendanceTotal: number;
  teamFailed: boolean;
  attendanceFailed: boolean;
}> {
  if (userIds.length === 0) {
    return {
      team: null,
      attendanceTotal: 0,
      teamFailed: false,
      attendanceFailed: false,
    };
  }

  let admin: SupabaseClient | null = null;
  try {
    admin = createAdminClient();
  } catch {
    return {
      team: null,
      attendanceTotal: 0,
      teamFailed: true,
      attendanceFailed: true,
    };
  }

  const { data: tmRows, error: tmErr } = await admin
    .from("teams_members")
    .select("team_id")
    .in("user_id", userIds)
    .limit(1);

  if (tmErr) {
    return {
      team: null,
      attendanceTotal: 0,
      teamFailed: true,
      attendanceFailed: false,
    };
  }

  let team: MemberTeamSummary | null = null;
  let teamFailed = false;
  const rawTid = tmRows?.[0]?.team_id;
  if (rawTid) {
    const tid = String(rawTid);
    const { data: trow, error: teamErr } = await admin
      .from("teams")
      .select("id, name, team_number")
      .eq("id", tid)
      .maybeSingle();
    if (teamErr) {
      teamFailed = true;
    } else if (trow?.id) {
      team = {
        id: String(trow.id),
        name: String(trow.name ?? "").trim() || "Team",
        team_number:
          typeof trow.team_number === "number"
            ? trow.team_number
            : Number(trow.team_number) || 0,
      };
    }
  }

  const { count, error: attErr } = await admin
    .from("events_attendance")
    .select("id", { count: "exact", head: true })
    .in("user_id", userIds);

  const attendanceFailed = Boolean(attErr);
  const attendanceTotal = attendanceFailed ? 0 : Number(count ?? 0);

  return {
    team,
    attendanceTotal,
    teamFailed,
    attendanceFailed,
  };
}

export async function fetchMemberDashboardOverview(
  supabase: SupabaseClient,
  authUser: { id: string; email?: string | null }
): Promise<MemberDashboardOverview> {
  const linkedIds = await getLinkedAppUserIds(supabase, authUser);

  const [phRes, teamAtt] = await Promise.all([
    fetchPointHistoryForSignedInUser(supabase, authUser),
    linkedIds.length > 0
      ? fetchTeamAndAttendanceCounts(linkedIds)
      : Promise.resolve({
          team: null as MemberTeamSummary | null,
          attendanceTotal: 0,
          teamFailed: false,
          attendanceFailed: false,
        }),
  ]);

  const nowIso = new Date().toISOString();

  const [evRes, oppRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, start_time, location")
      .eq("is_public", true)
      .not("start_time", "is", null)
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(5),
    supabase
      .from("active_opportunities")
      .select("id, title, category, link_url, display_order")
      .order("display_order", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  const upcomingPublicEvents =
    (evRes.data ?? [])?.map((e) => ({
      id: Number(e.id),
      title: String(e.title ?? ""),
      start_time:
        typeof e.start_time === "string"
          ? e.start_time
          : e.start_time != null
            ? String(e.start_time)
            : null,
      location:
        typeof e.location === "string"
          ? e.location
          : e.location != null
            ? String(e.location)
            : null,
    })) ?? [];

  const opportunities: ActiveOpportunityRow[] = (oppRes.data ?? []).map(
    (r) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      category:
        typeof r.category === "string"
          ? r.category
          : r.category != null
            ? String(r.category)
            : null,
      link_url: String(r.link_url ?? "#"),
    })
  );

  return {
    pointDataError: phRes.error,
    hasLinkedProfile: phRes.hasLinkedProfile,
    totalPoints: phRes.data.totalPoints,
    leaderboardRank: phRes.data.rank,
    team: teamAtt.team,
    eventAttendanceTotal: teamAtt.attendanceTotal,
    attendanceQueryFailed: teamAtt.attendanceFailed,
    teamQueryFailed: teamAtt.teamFailed,
    upcomingPublicEvents,
    opportunities,
    eventsFetchError: evRes.error?.message ?? null,
    opportunitiesFetchError: oppRes.error?.message ?? null,
  };
}
