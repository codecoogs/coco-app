-- Ensure members can SELECT point_transactions only for their app profile:
-- public.point_transactions.user_id = public.users.id where public.users.auth_id = auth.uid().
-- Uses SECURITY DEFINER lookup so this does not depend on SELECT policies on public.users.

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
  'Returns public.users.id for the JWT (auth.uid()) where users.auth_id matches, or NULL if unlinked. Used by RLS on points and point_transactions.';

REVOKE ALL ON FUNCTION public.current_public_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_public_user_id() TO authenticated;

DROP POLICY IF EXISTS "point_transactions_select_own" ON public.point_transactions;
CREATE POLICY "point_transactions_select_own"
  ON public.point_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = public.current_public_user_id());

COMMENT ON POLICY "point_transactions_select_own" ON public.point_transactions IS
  'SELECT when point_transactions.user_id equals public.users.id for the row with users.auth_id = auth.uid() (via current_public_user_id()).';
