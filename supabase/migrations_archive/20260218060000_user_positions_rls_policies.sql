-- RLS policies for user_positions: allow access based on app permissions
-- (view_officers = SELECT only; manage_officers = SELECT, INSERT, UPDATE, DELETE).
-- Current user is resolved via users.auth_id = auth.uid(); their position and
-- permissions come from user_positions -> positions -> position_permissions -> permissions.

-- Helper: true if the current auth user has the given permission or is admin
CREATE OR REPLACE FUNCTION public.current_user_has_permission(required_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN user_positions my_up ON my_up.user_id = u.id
    JOIN positions p ON p.title = my_up."positionTitle"
    LEFT JOIN position_permissions pp ON pp.position_id = p.id
    LEFT JOIN permissions perm ON perm.id = pp.permission_id AND perm.name = required_permission
    WHERE u.auth_id = auth.uid()
      AND (p.is_admin = true OR perm.id IS NOT NULL)
  );
$$;

-- SELECT: allow if user has view_officers OR manage_officers (or is_admin)
CREATE POLICY "user_positions_select_with_officer_permission"
ON public.user_positions
FOR SELECT
TO authenticated
USING (
  current_user_has_permission('view_officers')
  OR current_user_has_permission('manage_officers')
);

-- INSERT: allow if user has manage_officers
CREATE POLICY "user_positions_insert_with_manage_officers"
ON public.user_positions
FOR INSERT
TO authenticated
WITH CHECK (current_user_has_permission('manage_officers'));

-- UPDATE: allow if user has manage_officers
CREATE POLICY "user_positions_update_with_manage_officers"
ON public.user_positions
FOR UPDATE
TO authenticated
USING (current_user_has_permission('manage_officers'))
WITH CHECK (current_user_has_permission('manage_officers'));

-- DELETE: allow if user has manage_officers
CREATE POLICY "user_positions_delete_with_manage_officers"
ON public.user_positions
FOR DELETE
TO authenticated
USING (current_user_has_permission('manage_officers'));

COMMENT ON FUNCTION public.current_user_has_permission(text) IS
  'Returns true if the authenticated user (auth.uid()) has the given permission via their position, or is admin. Used by user_positions RLS.';
