CREATE OR REPLACE FUNCTION public.current_public_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_public_user_id() IS
  'Returns public.users.id for the JWT (auth.uid()), or NULL if unlinked. Used by RLS on points and similar.';

REVOKE ALL ON FUNCTION public.current_public_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_public_user_id() TO authenticated;

DROP POLICY IF EXISTS "points_select_own" ON public.points;
CREATE POLICY "points_select_own"
  ON public.points
  FOR SELECT
  TO authenticated
  USING (user_id = public.current_public_user_id());

COMMENT ON POLICY "points_select_own" ON public.points IS
  'Signed-in users read only their own point rows (matched via users.auth_id = auth.uid()).';