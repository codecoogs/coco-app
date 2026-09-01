-- Fix: deactivating an officer's position assignment (user_positions.is_active
-- = false, e.g. via the "Deactivate" button on /dashboard/officers) did not
-- actually revoke their app permissions. current_user_has_permission(),
-- public.user_profile, and current_user_can_select_point_categories() all
-- join user_positions -> positions without filtering on is_active, so a
-- deactivated assignment still counted. Every permission check in the app
-- reads from these (fetchUserProfile() -> hasPermission()/hasAnyPermission()
-- in lib/types/rbac.ts, and every RLS policy calling current_user_has_permission
-- directly), so this affected finances, officers, forms management,
-- memberships, permissions, team-management, tickets, point categories, and
-- the executive dashboard.
--
-- Other parts of this schema already got this right - see
-- 20260721140000_forms_rls.sql ("join ... up on up.user_id = u.id and
-- up.is_active is true") and 20260828130000_notifications_schema.sql
-- (notify_form_published) - this migration brings the three stragglers in
-- line with that same convention.

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
    JOIN public.user_positions my_up ON my_up.user_id = u.id AND my_up.is_active IS TRUE
    JOIN public.positions p ON p.title = my_up."positionTitle"
    WHERE u.auth_id = auth.uid()
      AND (
        p.is_admin IS TRUE
        OR EXISTS (
          SELECT 1
          FROM public.position_permissions pp
          JOIN public.permissions perm ON perm.id = pp.permission_id
          WHERE pp.position_id = p.id
            AND public.app_permission_matches(perm.name, required_permission)
        )
        OR (
          p.role_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.role_permissions rp
            JOIN public.permissions perm ON perm.id = rp.permission_id
            WHERE rp.role_id = p.role_id
              AND public.app_permission_matches(perm.name, required_permission)
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION public.current_user_has_permission(text) IS
  'RLS helper: true if auth.uid() has the permission via an ACTIVE position''s position_permissions or role_permissions, is_admin, or name aliases.';

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
    JOIN public.user_positions my_up ON my_up.user_id = u.id AND my_up.is_active IS TRUE
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
  'RLS helper: true if auth user may read point_categories via an ACTIVE position (events/categories perms, Executive/Admin role, or is_admin).';

-- Recreate the view to add the same filter. CREATE OR REPLACE VIEW can only
-- append columns, not change the FROM/WHERE - but this view adds no columns
-- here, only a filter, which CREATE OR REPLACE VIEW does allow.
CREATE OR REPLACE VIEW public.user_profile AS
SELECT
  u.auth_id,
  up.user_id,
  up."positionTitle" AS "positionTitle",
  r.name AS role_name,
  p.is_admin,
  (
    SELECT COALESCE(array_agg(DISTINCT sub.pname), ARRAY[]::text[])
    FROM (
      SELECT perm.name AS pname
      FROM public.position_permissions pp2
      JOIN public.permissions perm ON perm.id = pp2.permission_id
      WHERE pp2.position_id = p.id
      UNION
      SELECT perm2.name
      FROM public.role_permissions rp2
      JOIN public.permissions perm2 ON perm2.id = rp2.permission_id
      WHERE p.role_id IS NOT NULL
        AND rp2.role_id = p.role_id
    ) sub
  ) AS permissions
FROM public.user_positions up
JOIN public.users u ON u.id = up.user_id
JOIN public.positions p ON p.title = up."positionTitle"
LEFT JOIN public.roles r ON r.id = p.role_id
WHERE up.is_active IS TRUE;
