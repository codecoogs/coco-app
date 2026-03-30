-- Branches: INSERT, UPDATE, DELETE for holders of manage_branch (SELECT already in 20260329100000).
-- REST "POST" / create maps to INSERT; reads to SELECT.

UPDATE public.permissions
SET description = 'Full CRUD on public.branches (SELECT, INSERT, UPDATE, DELETE).'
WHERE name = 'manage_branch';

DROP POLICY IF EXISTS "branches_insert_manage_branch" ON public.branches;
CREATE POLICY "branches_insert_manage_branch"
  ON public.branches
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_has_permission('manage_branch'));

DROP POLICY IF EXISTS "branches_update_manage_branch" ON public.branches;
CREATE POLICY "branches_update_manage_branch"
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING (public.current_user_has_permission('manage_branch'))
  WITH CHECK (public.current_user_has_permission('manage_branch'));

DROP POLICY IF EXISTS "branches_delete_manage_branch" ON public.branches;
CREATE POLICY "branches_delete_manage_branch"
  ON public.branches
  FOR DELETE
  TO authenticated
  USING (public.current_user_has_permission('manage_branch'));

COMMENT ON POLICY "branches_insert_manage_branch" ON public.branches IS
  'Only manage_branch (or is_admin via helper) may insert rows.';

COMMENT ON POLICY "branches_update_manage_branch" ON public.branches IS
  'Only manage_branch (or is_admin via helper) may update rows.';

COMMENT ON POLICY "branches_delete_manage_branch" ON public.branches IS
  'Only manage_branch (or is_admin via helper) may delete rows.';
