-- Fix infinite recursion: policies that call current_user_has_permission() cause
-- the function to SELECT from user_positions, which re-triggers RLS.
--
-- Replace with a single SELECT policy that allows users to read only their own
-- row (using users.auth_id = auth.uid(), no read from user_positions in the policy).
-- The user_profile view then returns the current user's profile without recursion.
-- Officers list and mutations continue to use the service-role client (app checks permissions).

DROP POLICY IF EXISTS "user_positions_select_with_officer_permission" ON public.user_positions;
DROP POLICY IF EXISTS "user_positions_insert_with_manage_officers" ON public.user_positions;
DROP POLICY IF EXISTS "user_positions_update_with_manage_officers" ON public.user_positions;
DROP POLICY IF EXISTS "user_positions_delete_with_manage_officers" ON public.user_positions;
DROP FUNCTION IF EXISTS public.current_user_has_permission(text);

-- Allow authenticated users to read only their own user_positions row.
-- Uses only public.users (no read from user_positions), so no recursion.
CREATE POLICY "user_positions_select_own_row"
ON public.user_positions
FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
);
