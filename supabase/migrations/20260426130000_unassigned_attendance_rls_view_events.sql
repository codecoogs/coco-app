-- Allow dashboard users with view_events or manage_events to read unassigned attendance
-- (same audience as events attendance). Uses current_user_has_permission from earlier migrations.

ALTER TABLE public.unassigned_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unassigned_attendance_select_events_viewers" ON public.unassigned_attendance;
CREATE POLICY "unassigned_attendance_select_events_viewers"
  ON public.unassigned_attendance
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_has_permission('view_events')
    OR public.current_user_has_permission('manage_events')
  );

COMMENT ON POLICY "unassigned_attendance_select_events_viewers" ON public.unassigned_attendance IS
  'Event viewers/managers may read unassigned attendance rows for reporting and CSV workflows.';
