-- Branches: SELECT for holders of view_branch or manage_branch.
-- Requires public.current_user_has_permission(text) from 20260325120000_point_categories_rls_permissions.sql.

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
