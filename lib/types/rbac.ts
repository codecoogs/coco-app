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

/** Profile row returned from user_profile view (or equivalent join). */
export interface UserProfile {
  positionTitle: string;
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

/** Team portal: only these titles or is_admin may access. */
export const TEAM_ALLOWED_TITLES = ["Officer", "Executive", "Admin"] as const;

export function isTeamAllowed(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  return TEAM_ALLOWED_TITLES.some(
    (t) => t.toLowerCase() === profile.positionTitle.toLowerCase()
  );
}
