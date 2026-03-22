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
  positionTitle: string;
  /** Role name from public.roles (positions.role_id → roles.id). */
  roleName: string;
  is_admin: boolean;
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
 */
export const PERMISSION_NAMES = [
  "view_officers",
  "manage_officers",
  "view_memberships",
  "manage_memberships",
  "view_points",
  "manage_points",
] as const;

export type PermissionName = (typeof PERMISSION_NAMES)[number];

/**
 * Returns true if the user's profile has the given permission.
 * Admins (is_admin) are treated as having all permissions.
 */
export function hasPermission(
  profile: UserProfile | null,
  permission: PermissionName
): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  const list = profile.permissions ?? [];
  return list.includes(permission);
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
  return permissions.some((p) => list.includes(p));
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
  return permissions.every((p) => list.includes(p));
}
