import type { SupabaseClient } from "@supabase/supabase-js";

export type LeaderboardRow = {
  user_id: string;
  total_points: number | null;
  current_rank: number | null;
  users: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export async function fetchLeaderboardWithMembers(
  supabase: SupabaseClient
): Promise<{ data: LeaderboardRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("user_id, total_points, current_rank, users(first_name, last_name)")
    .order("total_points", { ascending: false, nullsFirst: false });

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []).map((raw) => {
    const row = raw as LeaderboardRow & {
      users?: LeaderboardRow["users"] | LeaderboardRow["users"][];
    };
    const u = row.users;
    const users = Array.isArray(u) ? u[0] ?? null : u ?? null;
    return { ...row, users } as LeaderboardRow;
  });
  return { data: rows, error: null };
}
