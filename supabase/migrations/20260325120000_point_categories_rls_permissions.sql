-- Permissions for events + point categories; RLS on point_categories for authenticated users.
-- Helpers are SECURITY DEFINER so they can read user_positions without RLS recursion issues.

INSERT INTO public.permissions (name, description)
VALUES
  (
    'view_point_categories',
    'View point category definitions (name, points_value) for dashboards and event forms.'
  ),
  (
    'manage_point_categories',
    'Create, update, and delete rows in public.point_categories.'
  ),
  (
    'view_events',
    'View the events management page (read-only unless combined with manage_events).'
  ),
  (
    'manage_events',
    'Create, edit, cancel events, flyers, and calendar sync.'
  )
ON CONFLICT (name) DO NOTHING;

-- True if the auth user has this permission via position_permissions, or holds an is_admin position.
CREATE OR REPLACE FUNCTION public.current_user_has_permission(required_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_positions my_up ON my_up.user_id = u.id
    JOIN public.positions p ON p.title = my_up."positionTitle"
    LEFT JOIN public.position_permissions pp ON pp.position_id = p.id
    LEFT JOIN public.permissions perm ON perm.id = pp.permission_id
      AND perm.name = required_permission
    WHERE u.auth_id = auth.uid()
      AND (p.is_admin IS TRUE OR perm.id IS NOT NULL)
  );
$$;

COMMENT ON FUNCTION public.current_user_has_permission(text) IS
  'RLS helper: true if auth.uid() has the named permission or an is_admin position. SECURITY DEFINER.';

-- SELECT on point_categories: event managers, category viewers, executives, admin role, or is_admin positions.
CREATE OR REPLACE FUNCTION public.current_user_can_select_point_categories()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_positions my_up ON my_up.user_id = u.id
    JOIN public.positions p ON p.title = my_up."positionTitle"
    LEFT JOIN public.roles r ON r.id = p.role_id
    WHERE u.auth_id = auth.uid()
      AND (
        p.is_admin IS TRUE
        OR lower(coalesce(r.name, '')) IN ('executive', 'admin')
        OR EXISTS (
          SELECT 1
          FROM public.position_permissions pp
          JOIN public.permissions perm ON perm.id = pp.permission_id
          WHERE pp.position_id = p.id
            AND perm.name IN (
              'view_point_categories',
              'manage_point_categories',
              'view_events',
              'manage_events'
            )
        )
      )
  );
$$;

COMMENT ON FUNCTION public.current_user_can_select_point_categories() IS
  'RLS helper: true if auth user may read point_categories (events/categories perms, Executive/Admin role, or is_admin).';

GRANT EXECUTE ON FUNCTION public.current_user_has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_select_point_categories() TO authenticated;

-- Attach the four permissions to Executive and Admin roles, and to all is_admin positions (explicit rows).
INSERT INTO public.position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM public.positions p
JOIN public.roles r ON r.id = p.role_id
CROSS JOIN public.permissions perm
WHERE lower(r.name) IN ('executive', 'admin')
  AND perm.name IN (
    'view_point_categories',
    'manage_point_categories',
    'view_events',
    'manage_events'
  )
ON CONFLICT (position_id, permission_id) DO NOTHING;

INSERT INTO public.position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM public.positions p
CROSS JOIN public.permissions perm
WHERE p.is_admin IS TRUE
  AND perm.name IN (
    'view_point_categories',
    'manage_point_categories',
    'view_events',
    'manage_events'
  )
ON CONFLICT (position_id, permission_id) DO NOTHING;

DROP POLICY IF EXISTS "point_categories_select_authenticated" ON public.point_categories;
CREATE POLICY "point_categories_select_authenticated"
  ON public.point_categories
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_select_point_categories());

DROP POLICY IF EXISTS "point_categories_insert_manage" ON public.point_categories;
CREATE POLICY "point_categories_insert_manage"
  ON public.point_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_has_permission('manage_point_categories'));

DROP POLICY IF EXISTS "point_categories_update_manage" ON public.point_categories;
CREATE POLICY "point_categories_update_manage"
  ON public.point_categories
  FOR UPDATE
  TO authenticated
  USING (public.current_user_has_permission('manage_point_categories'))
  WITH CHECK (public.current_user_has_permission('manage_point_categories'));

DROP POLICY IF EXISTS "point_categories_delete_manage" ON public.point_categories;
CREATE POLICY "point_categories_delete_manage"
  ON public.point_categories
  FOR DELETE
  TO authenticated
  USING (public.current_user_has_permission('manage_point_categories'));
