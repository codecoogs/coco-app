-- Bulk import for event attendance CSV.
-- Goals:
-- 1) For known members (match to public.users), insert into public.events_attendance
-- 2) For unknown attendees, insert into public.unassigned_attendance (is_user=false)
-- 3) When unassigned_attendance.is_user flips false->true, auto-insert into events_attendance
--
-- NOTE: public.unassigned_attendance table already exists (no CREATE TABLE here).

-- Helper: resolve the current user's app user id (public.users.id) from auth.uid().
-- Some environments may not have the earlier points migrations applied yet, so we
-- define it here to keep this migration self-contained.
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
  'Returns public.users.id for the JWT (auth.uid()) where users.auth_id matches, or NULL if unlinked.';

REVOKE ALL ON FUNCTION public.current_public_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_public_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_public_user_id() TO service_role;

-- Prevent duplicate check-ins for the same event+user.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_attendance_event_user_unique'
  ) THEN
    ALTER TABLE public.events_attendance
      ADD CONSTRAINT events_attendance_event_user_unique UNIQUE (event_id, user_id);
  END IF;
END $$;

-- Import function: attendees passed as JSONB array of objects.
-- Expected keys per row:
--   first_name, last_name, discord, personal_email, cougarnet_email, attended_at (optional)
CREATE OR REPLACE FUNCTION public.import_event_attendance_from_json(
  p_event_id bigint,
  p_attendees jsonb
)
RETURNS TABLE(inserted_events_attendance int, inserted_unassigned int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_events int := 0;
  n_unassigned int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.current_user_has_permission('manage_events') THEN
    RAISE EXCEPTION 'Missing permission: manage_events';
  END IF;
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event_id is required';
  END IF;
  IF p_attendees IS NULL OR jsonb_typeof(p_attendees) <> 'array' THEN
    RAISE EXCEPTION 'attendees must be a JSON array';
  END IF;

  WITH attendees AS (
    SELECT
      row_number() OVER () AS rn,
      NULLIF(trim(a.first_name), '') AS first_name,
      NULLIF(trim(a.last_name), '') AS last_name,
      NULLIF(trim(a.discord), '') AS discord,
      NULLIF(trim(a.personal_email), '') AS personal_email,
      NULLIF(trim(a.cougarnet_email), '') AS cougarnet_email,
      a.attended_at AS attended_at
    FROM jsonb_to_recordset(p_attendees) AS a(
      first_name text,
      last_name text,
      discord text,
      personal_email text,
      cougarnet_email text,
      attended_at timestamptz
    )
  ),
  matched AS (
    -- Match attendee -> users; dedupe per attendee by picking the earliest created user, then id.
    SELECT DISTINCT ON (a.rn)
      a.rn,
      u.id AS user_id,
      COALESCE(a.attended_at, (now() AT TIME ZONE 'utc'::text)) AS attended_at
    FROM attendees a
    JOIN public.users u
      ON (
        (a.discord IS NOT NULL AND lower(u.discord) = lower(a.discord))
        OR (a.personal_email IS NOT NULL AND lower(u.email) = lower(a.personal_email))
        OR (a.cougarnet_email IS NOT NULL AND lower(u.email) = lower(a.cougarnet_email))
        OR (
          a.first_name IS NOT NULL AND a.last_name IS NOT NULL
          AND lower(u.first_name) = lower(a.first_name)
          AND lower(u.last_name) = lower(a.last_name)
        )
      )
    ORDER BY a.rn, u.created ASC NULLS LAST, u.id ASC
  ),
  inserted_ea AS (
    INSERT INTO public.events_attendance (event_id, user_id, attended_at)
    SELECT p_event_id, m.user_id, m.attended_at
    FROM matched m
    ON CONFLICT (event_id, user_id) DO NOTHING
    RETURNING 1
  ),
  inserted_ua AS (
    INSERT INTO public.unassigned_attendance (
      event_id,
      first_name,
      last_name,
      discord,
      personal_email,
      cougarnet_email,
      is_user,
      attended_at,
      created_at,
      updated_at,
      created_by,
      updated_by
    )
    SELECT
      p_event_id,
      COALESCE(a.first_name, 'Unknown'),
      COALESCE(a.last_name, 'Unknown'),
      a.discord,
      a.personal_email,
      a.cougarnet_email,
      false,
      COALESCE(a.attended_at, (now() AT TIME ZONE 'utc'::text)),
      now(),
      now(),
      public.current_public_user_id(),
      public.current_public_user_id()
    FROM attendees a
    LEFT JOIN matched m ON m.rn = a.rn
    WHERE m.rn IS NULL
    RETURNING 1
  )
  SELECT
    (SELECT count(*) FROM inserted_ea),
    (SELECT count(*) FROM inserted_ua)
  INTO n_events, n_unassigned;

  inserted_events_attendance := COALESCE(n_events, 0);
  inserted_unassigned := COALESCE(n_unassigned, 0);
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.import_event_attendance_from_json(bigint, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.import_event_attendance_from_json(bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_event_attendance_from_json(bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_event_attendance_from_json(bigint, jsonb) TO service_role;

COMMENT ON FUNCTION public.import_event_attendance_from_json(bigint, jsonb) IS
  'Bulk import attendance: inserts known members into events_attendance, unknown into unassigned_attendance. Requires manage_events.';

-- Trigger: when unassigned_attendance.is_user becomes true, attempt to match to a user and insert into events_attendance.
-- We keep the row in unassigned_attendance (historical), per your requirement.
CREATE OR REPLACE FUNCTION public.handle_unassigned_attendance_became_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  -- Only act on false -> true.
  IF (TG_OP <> 'UPDATE') THEN
    RETURN NEW;
  END IF;
  IF COALESCE(OLD.is_user, false) = true OR COALESCE(NEW.is_user, false) = false THEN
    RETURN NEW;
  END IF;

  -- Find best match (same logic as import).
  SELECT u.id
  INTO uid
  FROM public.users u
  WHERE
    (NEW.discord IS NOT NULL AND lower(u.discord) = lower(NEW.discord))
    OR (NEW.personal_email IS NOT NULL AND lower(u.email) = lower(NEW.personal_email))
    OR (NEW.cougarnet_email IS NOT NULL AND lower(u.email) = lower(NEW.cougarnet_email))
    OR (
      NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL
      AND lower(u.first_name) = lower(NEW.first_name)
      AND lower(u.last_name) = lower(NEW.last_name)
    )
  ORDER BY u.created ASC NULLS LAST, u.id ASC
  LIMIT 1;

  IF uid IS NULL THEN
    -- Still can't match; keep row as-is.
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  INSERT INTO public.events_attendance (event_id, user_id, attended_at)
  VALUES (NEW.event_id, uid, COALESCE(NEW.attended_at, (now() AT TIME ZONE 'utc'::text)))
  ON CONFLICT (event_id, user_id) DO NOTHING;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_unassigned_attendance_became_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_unassigned_attendance_became_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_unassigned_attendance_became_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_unassigned_attendance_became_user() TO service_role;

DROP TRIGGER IF EXISTS unassigned_attendance_is_user_to_events_attendance ON public.unassigned_attendance;
CREATE TRIGGER unassigned_attendance_is_user_to_events_attendance
AFTER UPDATE OF is_user ON public.unassigned_attendance
FOR EACH ROW
EXECUTE FUNCTION public.handle_unassigned_attendance_became_user();

