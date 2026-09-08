-- Officers who only have manage_officers / manage_officer in permissions should pass
-- public.branches RLS (current_user_has_permission('manage_branch'|'view_branch')) when
-- managing the officers dashboard. Does not create or alter public.branches.

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
      OR (required = 'manage_branch' AND stored IN ('manage_officers', 'manage_officer'))
      OR (required = 'view_branch' AND stored IN ('manage_officers', 'manage_officer'))
    );
$$;

COMMENT ON FUNCTION public.app_permission_matches(text, text) IS
  'True if stored permission satisfies required (officer/branch aliases; manage_officers implies manage_branch and view_branch for RLS).';
