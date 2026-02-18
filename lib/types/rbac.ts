/**
 * RBAC types for position and permission data.
 * Matches the join of user_positions, positions, position_permissions, and permissions.
 */

export interface Permission {
  id: number;
  name: string;
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
