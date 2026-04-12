-- Branches: SELECT for holders of view_branch or manage_branch.
-- Requires public.current_user_has_permission(text) (extends with role_permissions in
-- 20260406120000; branch name aliases in 20260406200000). Grants may live in
-- public.position_permissions or public.role_permissions.

INSERT INTO public.permissions (name, description)
VALUES
  (
    'view_branch',
    'View branch definitions (name, description, active status).'
  ),
  (
    'manage_branch',
    'View branch definitions (same table access as view_branch for SELECT).'
  )
ON CONFLICT (name) DO NOTHING;

DROP POLICY IF EXISTS "branches_select_view_or_manage" ON public.branches;
CREATE POLICY "branches_select_view_or_manage"
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_has_permission('view_branch')
    OR public.current_user_has_permission('manage_branch')
  );

COMMENT ON POLICY "branches_select_view_or_manage" ON public.branches IS
  'Authenticated users may read branches if they have view_branch or manage_branch (or is_admin via helper).';
