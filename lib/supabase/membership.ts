import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True if the signed-in user (scoped by RLS - memberships_select_own) has a
 * membership row that's active and not past its end date. Works with either
 * a server or browser Supabase client, since it relies on RLS rather than an
 * explicit user_id filter.
 */
export async function hasActiveMembership(
  supabase: SupabaseClient
): Promise<boolean> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("memberships")
    .select("id")
    .eq("status", "active")
    .gte("ends_at", todayIso)
    .limit(1);
  return !!data?.length;
}
