import type { UserProfile } from "@/lib/types/rbac";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetches the current user's profile from the user_profile view.
 *
 * The view returns one row per (auth user, position assignment). Users with
 * multiple rows in user_positions therefore get multiple view rows. We merge
 * those rows: permissions are unioned, is_admin is true if any row is admin,
 * position titles and role names are deduplicated and joined for display.
 *
 * Query by auth_id (must match supabase.auth.getUser().id). Selects:
 * auth_id, user_id, positionTitle, role_name, is_admin, permissions.
 *
 * Returns null if the user has no position rows or on error.
 */
export async function fetchUserProfile(
  supabase: SupabaseClient,
  authId: string
): Promise<UserProfile | null> {
  const { data: rows, error } = await supabase
    .from("user_profile")
    .select("auth_id, user_id, positionTitle, role_name, is_admin, permissions")
    .eq("auth_id", authId);

  if (error) {
    console.error(
      "Error fetching profile:",
      error.message ?? error.code ?? JSON.stringify(error)
    );
    return null;
  }
  if (!rows?.length) return null;

  const permissionSet = new Set<string>();
  let is_admin = false;
  const titles: string[] = [];
  const roles: string[] = [];

  let mergedUserId: string | undefined;
  let mergedAuthId: string | undefined;

  for (const raw of rows) {
    const row = raw as Record<string, unknown>;

    if (row.is_admin === true) is_admin = true;

    const pt = row.positionTitle ?? row.positiontitle;
    if (typeof pt === "string" && pt.trim()) titles.push(pt.trim());

    const rn = row.role_name ?? row.rolename;
    if (typeof rn === "string" && rn.trim()) roles.push(rn.trim());

    if (mergedUserId === undefined && typeof row.user_id === "string") {
      mergedUserId = row.user_id;
    }
    if (mergedAuthId === undefined && typeof row.auth_id === "string") {
      mergedAuthId = row.auth_id;
    }

    const rawPermissions = row.permissions;
    if (Array.isArray(rawPermissions)) {
      for (const p of rawPermissions) {
        if (typeof p === "string" && p) permissionSet.add(p);
      }
    }
  }

  const uniqueTitles = [...new Set(titles)];
  const uniqueRoles = [...new Set(roles)];

  return {
    userId: mergedUserId,
    authId: mergedAuthId ?? authId,
    positionTitle: uniqueTitles.join(", "),
    roleName: uniqueRoles.join(", "),
    is_admin,
    permissions: [...permissionSet],
  };
}
