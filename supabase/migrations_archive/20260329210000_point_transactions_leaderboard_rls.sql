-- point_transactions: authenticated users read own rows; view_points / manage_points read all (dashboards).
-- leaderboard: any client with SELECT grant may read (public rankings).
-- Requires public.current_public_user_id() from 20260329200000_points_rls_select_own_user.sql
-- and public.current_user_has_permission(text) from 20260325120000_point_categories_rls_permissions.sql.

-- Own transactions (linked app user)
DROP POLICY IF EXISTS "point_transactions_select_own" ON public.point_transactions;
CREATE POLICY "point_transactions_select_own"
  ON public.point_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = public.current_public_user_id());

-- Officers / admins with points permissions see full history
DROP POLICY IF EXISTS "point_transactions_select_points_permission" ON public.point_transactions;
CREATE POLICY "point_transactions_select_points_permission"
  ON public.point_transactions
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_has_permission('view_points')
    OR public.current_user_has_permission('manage_points')
  );

COMMENT ON POLICY "point_transactions_select_own" ON public.point_transactions IS
  'Members read point_transactions where user_id matches their public.users row.';

COMMENT ON POLICY "point_transactions_select_points_permission" ON public.point_transactions IS
  'view_points or manage_points (or is_admin) may read all transactions.';

-- Leaderboard: readable by everyone (adjust if you need private leaderboards)
DROP POLICY IF EXISTS "leaderboard_select_authenticated" ON public.leaderboard;
CREATE POLICY "leaderboard_select_authenticated"
  ON public.leaderboard
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "leaderboard_select_anon" ON public.leaderboard;
CREATE POLICY "leaderboard_select_anon"
  ON public.leaderboard
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "leaderboard_select_authenticated" ON public.leaderboard IS
  'All signed-in users may read leaderboard totals and ranks.';

COMMENT ON POLICY "leaderboard_select_anon" ON public.leaderboard IS
  'Anonymous clients may read leaderboard (e.g. public site embed).';
