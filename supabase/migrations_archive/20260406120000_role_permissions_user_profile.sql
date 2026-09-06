-- role_permissions: grant permissions by role (public.roles), merged with position_permissions in user_profile.
-- Also extends current_user_has_permission() to check role_permissions and to treat manage_officer/view_officer
-- as aliases for manage_officers/view_officers (and the reverse).

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id bigint NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions IS
  'Maps roles to permissions; combined with position_permissions for RLS and user_profile.';

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_select_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

-- Match stored permission names in DB to what RLS / the app requests (singular vs plural).
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
    );
$$;

COMMENT ON FUNCTION public.app_permission_matches(text, text) IS
  'True if stored permission name satisfies required (handles manage_officer/manage_officers and view_* aliases).';

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
  'RLS helper: true if auth.uid() has the permission via position_permissions or role_permissions, is_admin, or name aliases.';

-- One row per user_positions assignment; permissions = union of position + role grants for that position.
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
LEFT JOIN public.roles r ON r.id = p.role_id;
