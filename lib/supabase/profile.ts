import type { UserProfile } from "@/lib/types/rbac";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetches the current user's profile from the user_profile view.
 * The view aggregates position title, role name, is_admin, and permissions
 * for the user identified by auth_id (must match supabase.auth.getUser().id).
 *
 * When using RLS and security_invoker on the view, query with the user's auth_id
 * so the view runs in their security context.
 *
 * Returns null if the user has no position (not in user_positions) or on error.
 * Handles null positionTitle / role_name from the view (left joins).
 */
export async function fetchUserProfile(
  supabase: SupabaseClient,
  authId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profile")
    .select("positionTitle, role_name, is_admin, permissions")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) {
    console.error(
      "Error fetching profile:",
      error.message ?? error.code ?? JSON.stringify(error)
    );
    return null;
  }
  if (!data) return null;

  const rawPermissions = data.permissions;
  const permissions: string[] = Array.isArray(rawPermissions)
    ? rawPermissions.filter((p): p is string => typeof p === "string")
    : [];

  return {
    positionTitle: data.positionTitle ?? "",
    roleName: data.role_name ?? "",
    is_admin: Boolean(data.is_admin),
    permissions,
  };
}
