-- Allow authenticated users to read their own public.users row and rows for anyone on the leaderboard
-- (so the leaderboard UI can show names via PostgREST embed users(...)).

DROP POLICY IF EXISTS "users_select_own_or_leaderboard" ON public.users;
CREATE POLICY "users_select_own_or_leaderboard"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth_id = auth.uid()
    OR id IN (SELECT l.user_id FROM public.leaderboard l)
  );

COMMENT ON POLICY "users_select_own_or_leaderboard" ON public.users IS
  'Self row (auth_id match) plus minimal exposure for members listed on leaderboard (for rankings UI).';
