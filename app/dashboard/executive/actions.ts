"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { hasPermission } from "@/lib/types/rbac";

const SERVICE_ROLE_ERROR =
  "SUPABASE_SERVICE_ROLE_KEY is not set on the server. The executive dashboard needs the service role key to read sign-up data.";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const GROWTH_WEEKS = 10;

export type DailyPoint = { date: string; count: number };
export type WeeklyTotalPoint = { date: string; total: number };

export type ExecutiveDashboardData = {
  signups: DailyPoint[];
  memberships: DailyPoint[];
  growth: WeeklyTotalPoint[];
  formSubmissions: DailyPoint[];
  error: string | null;
};

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Start of the 7-calendar-day window (UTC) ending today, inclusive. */
function last7DayCutoff(): Date {
  return new Date(utcDayStart(new Date()).getTime() - 6 * DAY_MS);
}

/** `public.users.created` has no tz offset in its serialized value - treat it as UTC explicitly. */
function parseNaiveAsUtc(value: string): Date {
  return new Date(value.endsWith("Z") ? value : `${value}Z`);
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Buckets a list of UTC timestamps into the last `days` UTC calendar days (oldest first). */
function bucketDaily(dates: Date[], days = 7): DailyPoint[] {
  const today = utcDayStart(new Date());
  const order: { key: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    order.push({ key: d.toISOString().slice(0, 10), label: formatDayLabel(d) });
  }
  const counts = new Map(order.map(({ key }) => [key, 0]));
  for (const dt of dates) {
    const key = utcDayStart(dt).toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return order.map(({ key, label }) => ({ date: label, count: counts.get(key) ?? 0 }));
}

/** Cumulative total-user count, one point per week for the last `weeks` weeks (oldest first, last point = current total). */
function bucketCumulativeWeekly(dates: Date[], weeks = GROWTH_WEEKS): WeeklyTotalPoint[] {
  const sortedMs = [...dates].map((d) => d.getTime()).sort((a, b) => a - b);
  const now = Date.now();
  const points: WeeklyTotalPoint[] = [];
  let idx = 0;
  for (let i = weeks - 1; i >= 0; i--) {
    const weekEndMs = now - i * WEEK_MS;
    while (idx < sortedMs.length && sortedMs[idx] <= weekEndMs) idx++;
    points.push({ date: formatDayLabel(new Date(weekEndMs)), total: idx });
  }
  return points;
}

async function requireViewExecutiveDashboard(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "view_executive_dashboard")) {
    return { ok: false, error: "You do not have permission to view the executive dashboard." };
  }
  return { ok: true };
}

const EMPTY: ExecutiveDashboardData = {
  signups: [],
  memberships: [],
  growth: [],
  formSubmissions: [],
  error: null,
};

export async function getExecutiveDashboardData(): Promise<ExecutiveDashboardData> {
  const gate = await requireViewExecutiveDashboard();
  if (!gate.ok) return { ...EMPTY, error: gate.error };

  const admin = getServiceRoleClient();
  if (!admin) return { ...EMPTY, error: SERVICE_ROLE_ERROR };

  // memberships/form_responses already grant Executive/Admin read access via
  // RLS (manage_memberships / manage_forms); public.users does not (self +
  // leaderboard only), so it needs the service-role client regardless. Using
  // it for all three here keeps this file's queries uniform.
  const cutoff = last7DayCutoff();
  const cutoffNaive = cutoff.toISOString().replace("Z", "");

  const [usersRes, allUsersRes, membershipsRes, formResponsesRes] = await Promise.all([
    admin.from("users").select("created").gte("created", cutoffNaive),
    admin.from("users").select("created").order("created", { ascending: true }).limit(50000),
    admin
      .from("memberships")
      .select("created_at")
      .gte("created_at", cutoff.toISOString())
      .neq("status", "refunded"),
    admin.from("form_responses").select("submitted_at").gte("submitted_at", cutoff.toISOString()),
  ]);

  const firstError =
    usersRes.error?.message ??
    allUsersRes.error?.message ??
    membershipsRes.error?.message ??
    formResponsesRes.error?.message ??
    null;

  const signups = bucketDaily((usersRes.data ?? []).map((r) => parseNaiveAsUtc(r.created)));
  const growth = bucketCumulativeWeekly(
    (allUsersRes.data ?? []).map((r) => parseNaiveAsUtc(r.created))
  );
  const memberships = bucketDaily(
    (membershipsRes.data ?? []).map((r) => new Date(r.created_at))
  );
  const formSubmissions = bucketDaily(
    (formResponsesRes.data ?? []).map((r) => new Date(r.submitted_at))
  );

  return { signups, memberships, growth, formSubmissions, error: firstError };
}
