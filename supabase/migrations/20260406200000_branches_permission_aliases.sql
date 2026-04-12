-- Branch table access uses branches_* RLS policies, which call current_user_has_permission().
-- That helper already resolves grants from BOTH position_permissions and role_permissions
-- (see migration 20260406120000_role_permissions_user_profile.sql). This migration extends
-- app_permission_matches() so plural DB names (view_branches / manage_branches) satisfy
-- RLS checks for view_branch / manage_branch (and the reverse).

CREATE OR REPLACE FUNCTION public.app_permission_matches(stored text, required text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT stored IS NOT NULL
    AND required IS NOT NULL
    AND (
      stored = required
      OR (required = 'manage_officers' AND stored = 'manage_officer')
      OR (required = 'view_officers' AND stored = 'view_officer')
      OR (required = 'manage_officer' AND stored = 'manage_officers')
      OR (required = 'view_officer' AND stored = 'view_officers')
      OR (required = 'view_branch' AND stored = 'view_branches')
      OR (required = 'manage_branch' AND stored = 'manage_branches')
      OR (required = 'view_branches' AND stored = 'view_branch')
      OR (required = 'manage_branches' AND stored = 'manage_branch')
    );
$$;

COMMENT ON FUNCTION public.app_permission_matches(text, text) IS
  'True if stored permission name satisfies required (officer and branch singular/plural aliases). Used by current_user_has_permission for position_permissions and role_permissions.';

COMMENT ON POLICY "branches_select_view_or_manage" ON public.branches IS
  'SELECT: authenticated users with view_branch or manage_branch (or aliases), granted via position_permissions or role_permissions, or is_admin — see current_user_has_permission().';

COMMENT ON POLICY "branches_insert_manage_branch" ON public.branches IS
  'INSERT: manage_branch (or alias manage_branches), via position_permissions or role_permissions, or is_admin.';

COMMENT ON POLICY "branches_update_manage_branch" ON public.branches IS
  'UPDATE: manage_branch (or alias manage_branches), via position_permissions or role_permissions, or is_admin.';

COMMENT ON POLICY "branches_delete_manage_branch" ON public.branches IS
  'DELETE: manage_branch (or alias manage_branches), via position_permissions or role_permissions, or is_admin.';
