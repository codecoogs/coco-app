import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the current signed-in user's app user id (public.users.id).
 * Use this for created_by / updated_by — NOT auth_id.
 */
export async function getCurrentAppUserId(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return null;

  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
