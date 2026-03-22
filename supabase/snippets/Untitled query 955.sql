CREATE POLICY "user_positions_select_own_row"
ON public.user_positions
FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
);