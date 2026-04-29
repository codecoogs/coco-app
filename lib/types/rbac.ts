/**
 * RBAC types for position and permission data.
 * Matches the join of user_positions, positions, position_permissions, and permissions.
 *
 * Database:
 * - public.permissions: id (uuid), name (text), description (text), created_at (timestamptz).
 * - public.position_permissions: id (uuid), position_id (bigint → positions), permission_id (uuid → permissions).
 * - user_profile view aggregates permission names per user via these tables.
 *
 * Dynamic permissions:
 * - user_profile view returns permissions[] (array of permission names) per user.
 * - Use these names in DB and in PERMISSION_NAMES. View permissions gate tab/page visibility; manage permissions gate create/edit/deactivate.
 */

export interface Permission {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
}

export interface Position {
  id: number;
  title: string;
  is_admin: boolean;
}

/** Profile row returned from user_profile view (joins user_positions → positions → roles). */
export interface UserProfile {
  /** public.users.id when loaded from user_profile.user_id. */
  userId?: string;
  /** Supabase Auth id; matches auth.getUser().id when loaded from user_profile.auth_id. */
  authId?: string;
  /** One position title, or comma-separated when the user has multiple assignments. */
  positionTitle: string;
  /** Role name from public.roles (positions.role_id → roles.id). */
  roleName: string;
  is_admin: boolean;
  /** Union of permission names from all user_profile rows for this auth_id. */
  permissions: string[];
}

/** Auth user plus enriched profile for session/context. */
export interface EnrichedUser {
  id: string;
  email: string | undefined;
  created_at: string;
  last_sign_in_at: string | undefined;
  /** From profile; undefined if not loaded or no position. */
  profile: UserProfile | null;
}

/** Team portal: only these role names (from public.roles) or positions.is_admin may access. */
export const TEAM_ALLOWED_ROLES = ["Officer", "Executive", "Admin"] as const;

export function isTeamAllowed(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  return TEAM_ALLOWED_ROLES.some(
    (r) => r.toLowerCase() === (profile.roleName ?? "").toLowerCase()
  );
}

/**
 * Permission names used by the app. Must match rows in public.permissions.
 * Assign to positions via position_permissions (position_id, permission_id).
 *
 * Convention:
 * - view_*: can see the tab/page (read-only).
 * - manage_*: can create, edit, and set is_active (or equivalent) for that resource.
 * - DB may use singular names (e.g. manage_officer); hasPermission() accepts both for officers.
 * - view_events / manage_events: events page (view_any) vs create/edit/cancel.
 * - view_point_categories / manage_point_categories: read vs edit point_categories (RLS).
 */
export const PERMISSION_NAMES = [
  "view_officers",
  "manage_officers",
  "view_memberships",
  "manage_memberships",
  "view_points",
  "manage_points",
  "view_point_categories",
  "manage_point_categories",
  "view_events",
  "manage_events",
  "view_tickets",
  "manage_tickets",
  "view_teams",
  "manage_teams",
  "view_branch",
  "manage_branch",
] as const;

export type PermissionName = (typeof PERMISSION_NAMES)[number];

/**
 * Returns true if the user's profile has the given permission.
 * Admins (is_admin) are treated as having all permissions.
 */
/** DB may store singular names (e.g. manage_officer) while the app uses manage_officers. */
function profileHasPermissionName(
  list: readonly string[],
  permission: PermissionName
): boolean {
  if (list.includes(permission)) return true;
  if (permission === "manage_officers") {
    return list.includes("manage_officer");
  }
  if (permission === "view_officers") {
    return list.includes("view_officer");
  }
  if (permission === "view_branch") {
    return list.includes("view_branches");
  }
  if (permission === "manage_branch") {
    return list.includes("manage_branches");
  }
  if (permission === "manage_teams") {
    return list.includes("manage_team");
  }
  if (permission === "view_teams") {
    return list.includes("view_team");
  }
  return false;
}

export function hasPermission(
  profile: UserProfile | null,
  permission: PermissionName
): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  const list = profile.permissions ?? [];
  return profileHasPermissionName(list, permission);
}

/**
 * Returns true if the user has any of the given permissions.
 */
export function hasAnyPermission(
  profile: UserProfile | null,
  permissions: readonly PermissionName[]
): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  const list = profile.permissions ?? [];
  return permissions.some((p) => profileHasPermissionName(list, p));
}

/**
 * Returns true if the user has all of the given permissions.
 */
export function hasAllPermissions(
  profile: UserProfile | null,
  permissions: readonly PermissionName[]
): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  const list = profile.permissions ?? [];
  return permissions.every((p) => profileHasPermissionName(list, p));
}
