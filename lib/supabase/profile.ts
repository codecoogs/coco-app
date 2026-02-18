import type { UserProfile } from "@/lib/types/rbac";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetches the current user's position title, role name (from roles), is_admin, and permissions in a single request.
 * Uses the `user_profile` view; see lib/supabase/user_profile_view.sql.
 * Team access is determined by roles.name (Officer/Executive/Admin) or positions.is_admin.
 */
export async function fetchUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profile")
    .select("positionTitle, role_name, is_admin, permissions")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    positionTitle: data.positionTitle ?? "",
    roleName: data.role_name ?? "",
    is_admin: Boolean(data.is_admin),
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };
}
