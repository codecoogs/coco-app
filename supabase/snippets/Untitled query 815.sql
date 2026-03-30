-- RLS for public.events: public rows readable broadly; view/manage_events for full access; manage_events for writes.
-- Requires public.current_user_has_permission(text) from 20260325120000_point_categories_rls_permissions.sql.

-- Anyone using the anon key can read events marked public (e.g. marketing / logged-out views).
DROP POLICY IF EXISTS "events_select_anon_public_only" ON public.events;
CREATE POLICY "events_select_anon_public_only"
  ON public.events
  FOR SELECT
  TO anon
  USING (is_public IS TRUE);

-- Logged-in users: public events, or holders of view_events / manage_events (includes is_admin via helper).
DROP POLICY IF EXISTS "events_select_authenticated" ON public.events;
CREATE POLICY "events_select_authenticated"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    is_public IS TRUE
    OR public.current_user_has_permission('view_events')
    OR public.current_user_has_permission('manage_events')
  );

DROP POLICY IF EXISTS "events_insert_manage" ON public.events;
CREATE POLICY "events_insert_manage"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_has_permission('manage_events'));

DROP POLICY IF EXISTS "events_update_manage" ON public.events;
CREATE POLICY "events_update_manage"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (public.current_user_has_permission('manage_events'))
  WITH CHECK (public.current_user_has_permission('manage_events'));

DROP POLICY IF EXISTS "events_delete_manage" ON public.events;
CREATE POLICY "events_delete_manage"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (public.current_user_has_permission('manage_events'));

COMMENT ON POLICY "events_select_anon_public_only" ON public.events IS
  'Unauthenticated clients may SELECT only rows with is_public = true.';

COMMENT ON POLICY "events_select_authenticated" ON public.events IS
  'Members see public events, or all events if they have view_events or manage_events.';

COMMENT ON POLICY "events_insert_manage" ON public.events IS
  'Only manage_events (or is_admin position) may insert.';

COMMENT ON POLICY "events_update_manage" ON public.events IS
  'Only manage_events (or is_admin position) may update.';

COMMENT ON POLICY "events_delete_manage" ON public.events IS
  'Only manage_events (or is_admin position) may delete.';
