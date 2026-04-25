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
  users: LeaderboardMemberProfile | null;
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
  supabase: SupabaseClient
): Promise<{ data: LeaderboardRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select(
      "user_id, total_points, current_rank, users!leaderboard_user_id_fkey(first_name, last_name, email, discord, avatar_url)"
    )
    .order("total_points", { ascending: false, nullsFirst: false });

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const users = normalizeUsersEmbed(row);
    return {
      user_id: row.user_id as string,
      total_points: (row.total_points as number | null) ?? null,
      current_rank: (row.current_rank as number | null) ?? null,
      users,
    } as LeaderboardRow;
  });
  return { data: rows, error: null };
}
