import type { SupabaseClient } from "@supabase/supabase-js";

export type LeaderboardMemberProfile = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  discord: string | null;
  avatar_url: string | null;
};

export type LeaderboardRow = {
  user_id: string;
  total_points: number | null;
  current_rank: number | null;
  /** Same as count of members sharing this total_points when DB is current; used for "(tied)". */
  points_tie_group_size: number | null;
  users: LeaderboardMemberProfile | null;
};

export const LEADERBOARD_PAGE_SIZE = 20;

export type FetchLeaderboardOptions = {
  page?: number;
  pageSize?: number;
};

function normalizeUsersEmbed(raw: Record<string, unknown>): LeaderboardMemberProfile | null {
  const hinted = raw["users!leaderboard_user_id_fkey"];
  const u = raw.users ?? (typeof hinted !== "undefined" ? hinted : null);
  if (u == null) return null;
  if (Array.isArray(u)) {
    const first = u[0] as LeaderboardMemberProfile | undefined;
    return first ?? null;
  }
  const o = u as LeaderboardMemberProfile;
  return {
    first_name: o.first_name ?? null,
    last_name: o.last_name ?? null,
    email: o.email ?? null,
    discord: o.discord ?? null,
    avatar_url: o.avatar_url ?? null,
  };
}

export async function fetchLeaderboardWithMembers(
  supabase: SupabaseClient,
  options?: FetchLeaderboardOptions
): Promise<{
  data: LeaderboardRow[];
  totalCount: number | null;
  error: string | null;
}> {
  const rawSize = options?.pageSize ?? LEADERBOARD_PAGE_SIZE;
  const pageSize = Math.min(Math.max(rawSize, 1), 100);
  const page = Math.max(options?.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("leaderboard")
    .select(
      "user_id, total_points, current_rank, points_tie_group_size, users!leaderboard_user_id_fkey(first_name, last_name, email, discord, avatar_url)",
      { count: "exact" }
    )
    .order("total_points", { ascending: false, nullsFirst: false })
    .order("user_id", { ascending: true })
    .range(from, to);

  if (error) return { data: [], totalCount: null, error: error.message };

  const rows = (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const users = normalizeUsersEmbed(row);
    const t = row.points_tie_group_size;
    const tieSz =
      typeof t === "number" && Number.isFinite(t) && t >= 1
        ? Math.trunc(t)
        : typeof t === "string" && /^\d+$/.test(t.trim())
          ? parseInt(t.trim(), 10)
          : null;

    return {
      user_id: row.user_id as string,
      total_points: (row.total_points as number | null) ?? null,
      current_rank: (row.current_rank as number | null) ?? null,
      points_tie_group_size: tieSz != null && tieSz >= 1 ? tieSz : null,
      users,
    } as LeaderboardRow;
  });
  return {
    data: rows,
    totalCount: typeof count === "number" ? count : null,
    error: null,
  };
}
