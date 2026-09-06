-- ============================================================================
-- BASELINE SCHEMA — squashed from production on 2026-09-06
-- ============================================================================
-- Replaces the 72 migrations now kept in supabase/migrations_archive/ (and in
-- git history). Those could not replay from scratch: two files were ordered
-- before the dump that created their tables, and production had drifted —
-- columns, and whole tables (deleted_users, unassigned_attendance), that no
-- migration ever created because they were added through the dashboard.
--
-- This file is a dump of production's real schema, so a fresh database built
-- from it matches production by construction. Intended for FRESH databases
-- (branch creation, `supabase db reset`); it does not guard against existing
-- objects.
--
-- Sections 2-4 are hand-appended because `supabase db dump --schema public`
-- does not capture them. Do not drop them when regenerating this file.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. public schema (generated: supabase db dump --linked --schema public)
-- ---------------------------------------------------------------------------



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."academic_years_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."academic_years_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_permission_matches"("stored" "text", "required" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT stored IS NOT NULL
    AND required IS NOT NULL
    AND (
      stored = required
      OR (required = 'manage_officers' AND stored = 'manage_officer')
      OR (required = 'view_officers' AND stored = 'view_officer')
      OR (required = 'manage_officer' AND stored = 'manage_officers')
      OR (required = 'view_officer' AND stored = 'view_officers')
      OR (required = 'view_branch' AND stored = 'view_branches')
      OR (required = 'manage_branch' AND stored = 'manage_branches')
      OR (required = 'view_branches' AND stored = 'view_branch')
      OR (required = 'manage_branches' AND stored = 'manage_branch')
      OR (required = 'manage_branch' AND stored IN ('manage_officers', 'manage_officer'))
      OR (required = 'view_branch' AND stored IN ('manage_officers', 'manage_officer'))
    );
$$;


ALTER FUNCTION "public"."app_permission_matches"("stored" "text", "required" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."app_permission_matches"("stored" "text", "required" "text") IS 'True if stored permission satisfies required (officer/branch aliases; manage_officers implies manage_branch and view_branch for RLS).';



CREATE OR REPLACE FUNCTION "public"."award_team_participation_points_for_member"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_category_id uuid;
  v_current_year_id uuid;
  v_eligible boolean;
  sys_uid uuid := '00000000-0000-0000-0000-000000000001'::uuid;
begin
  select
    exists (
      select 1
      from public.memberships m
      where m.user_id = new.user_id
        and m.status = 'active'
        and m.ends_at >= current_date
    )
    or exists (
      select 1
      from public.user_profile up
      where up.user_id = new.user_id
        and (
          up.is_admin
          or lower(coalesce(up."positionTitle", '') || ' ' || coalesce(up.role_name, ''))
             ~ '(intern|officer|executive|admin)'
        )
    )
  into v_eligible;

  if not v_eligible then
    return new;
  end if;

  select pc.id
  into v_category_id
  from public.point_categories pc
  where pc.id = 'e9633368-5080-4f25-9caa-0c7b14df2f53'::uuid
     or lower(trim(pc.name)) = lower(trim('Team Participation'))
  order by
    case
      when pc.id = 'e9633368-5080-4f25-9caa-0c7b14df2f53'::uuid then 0
      else 1
    end
  limit 1;

  if v_category_id is null then
    raise warning 'award_team_participation_points_for_member: Team Participation point category not found';
    return new;
  end if;

  select id into v_current_year_id from public.academic_years where is_current = true limit 1;

  if exists (
    select 1
    from public.point_transactions t
    where t.user_id = new.user_id
      and t.category_id = v_category_id
      and t.academic_year_id is not distinct from v_current_year_id
  ) then
    return new;
  end if;

  insert into public.point_transactions (
    user_id,
    category_id,
    points_earned,
    created_by,
    updated_by
  )
  values (
    new.user_id,
    v_category_id,
    null,
    sys_uid,
    sys_uid
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."award_team_participation_points_for_member"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."award_team_participation_points_for_member"() IS 'After insert on teams_members: insert one point_transactions row for Team Participation if none exists for that user.';



CREATE OR REPLACE FUNCTION "public"."create_point_transaction_on_attendance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_category_id uuid;
  v_points_value integer;
  v_academic_year_id uuid;
BEGIN
  -- Get the category id and points value from the event's point_category
  SELECT pc.id, pc.points_value
  INTO v_category_id, v_points_value
  FROM events e
  JOIN point_categories pc ON pc.name = e.point_category
  WHERE e.id = NEW.event_id;

  -- If the event has no point category, skip silently
  IF v_category_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the current active academic year (adjust this query to your schema if needed)
  SELECT id INTO v_academic_year_id
  FROM academic_years
  WHERE now() BETWEEN start_date AND end_date
  LIMIT 1;

  -- Insert the point transaction
  INSERT INTO point_transactions (
    user_id,
    category_id,
    event_id,
    points_earned,
    academic_year_id,
    created_by,
    updated_by
  ) VALUES (
    NEW.user_id,
    v_category_id,
    NEW.event_id,
    v_points_value,
    v_academic_year_id,
    NEW.created_by,
    NEW.updated_by
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_point_transaction_on_attendance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_public_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."current_public_user_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_public_user_id"() IS 'Returns public.users.id for the JWT (auth.uid()) where users.auth_id matches, or NULL if unlinked.';



CREATE OR REPLACE FUNCTION "public"."current_user_can_select_point_categories"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_positions my_up ON my_up.user_id = u.id AND my_up.is_active IS TRUE
    JOIN public.positions p ON p.title = my_up."positionTitle"
    LEFT JOIN public.roles r ON r.id = p.role_id
    WHERE u.auth_id = auth.uid()
      AND (
        p.is_admin IS TRUE
        OR lower(coalesce(r.name, '')) IN ('executive', 'admin')
        OR EXISTS (
          SELECT 1
          FROM public.position_permissions pp
          JOIN public.permissions perm ON perm.id = pp.permission_id
          WHERE pp.position_id = p.id
            AND perm.name IN (
              'view_point_categories',
              'manage_point_categories',
              'view_events',
              'manage_events'
            )
        )
      )
  );
$$;


ALTER FUNCTION "public"."current_user_can_select_point_categories"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_user_can_select_point_categories"() IS 'RLS helper: true if auth user may read point_categories via an ACTIVE position (events/categories perms, Executive/Admin role, or is_admin).';



CREATE OR REPLACE FUNCTION "public"."current_user_can_view_form"("p_form_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.forms f
    where f.id = p_form_id
      and (
        f.audience_type = 'everyone'
        or (
          f.audience_type = 'roles'
          and exists (
            select 1
            from public.users u
            join public.user_positions up on up.user_id = u.id and up.is_active is true
            join public.positions pos on pos.title = up."positionTitle"
            join public.form_audience_roles far on far.form_id = f.id and far.role_id = pos.role_id
            where u.auth_id = auth.uid()
          )
        )
        or (
          f.audience_type = 'positions'
          and exists (
            select 1
            from public.users u
            join public.user_positions up on up.user_id = u.id and up.is_active is true
            join public.positions pos on pos.title = up."positionTitle"
            join public.form_audience_positions fap on fap.form_id = f.id and fap.position_id = pos.id
            where u.auth_id = auth.uid()
          )
        )
      )
  );
$$;


ALTER FUNCTION "public"."current_user_can_view_form"("p_form_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_user_can_view_form"("p_form_id" "uuid") IS 'RLS helper: true if auth.uid() is in the audience for this form (everyone/roles/positions). Combine with status/is_active checks.';



CREATE OR REPLACE FUNCTION "public"."current_user_has_permission"("required_permission" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_positions my_up ON my_up.user_id = u.id AND my_up.is_active IS TRUE
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


ALTER FUNCTION "public"."current_user_has_permission"("required_permission" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_user_has_permission"("required_permission" "text") IS 'RLS helper: true if auth.uid() has the permission via an ACTIVE position''s position_permissions or role_permissions, is_admin, or name aliases.';



CREATE OR REPLACE FUNCTION "public"."finance_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."finance_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finance_set_updated_on"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_on = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."finance_set_updated_on"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forms_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."forms_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_auth_activity_stats"() RETURNS TABLE("active_7d" integer, "active_30d" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Raise rather than filter. A permission check in the WHERE clause of an
  -- aggregate query returns zeros for an unauthorized caller, which reads as
  -- "nobody signed in" instead of "you may not see this".
  if not public.current_user_has_permission('view_executive_dashboard') then
    raise exception 'permission denied: view_executive_dashboard is required';
  end if;

  return query
  select
    count(*) filter (
      where u.last_sign_in_at >= now() - interval '7 days'
    )::integer,
    count(*) filter (
      where u.last_sign_in_at >= now() - interval '30 days'
    )::integer
  from auth.users u
  where u.deleted_at is null;
end;
$$;


ALTER FUNCTION "public"."get_auth_activity_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_auth_activity_stats"() IS 'Distinct accounts whose most recent sign-in falls in the last 7/30 days. Aggregates only - never returns per-user rows. Requires view_executive_dashboard.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user_link"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  existing_phone text;
  row_count int;
  meta_first text;
  meta_last text;
  meta_major text;
  meta_grad text;
  meta_uh_id text;
BEGIN
  meta_first := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  meta_last := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), '');
  meta_major := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'major', '')), '');
  meta_grad := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'expected_graduation', '')), '');
  meta_uh_id := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'uh_id', '')), '');

  UPDATE public.users
  SET
    auth_id = NEW.id,
    first_name = COALESCE(meta_first, first_name),
    last_name = COALESCE(meta_last, last_name),
    major = COALESCE(meta_major, major),
    expected_graduation = COALESCE(meta_grad, expected_graduation),
    uh_id = COALESCE(meta_uh_id, uh_id),
    discord = COALESCE(
      discord,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'user_name'
    )
  WHERE email = NEW.email
  RETURNING phone INTO existing_phone;

  GET DIAGNOSTICS row_count = ROW_COUNT;

  IF row_count > 0 THEN
    IF existing_phone IS NOT NULL AND existing_phone != '' THEN
      UPDATE auth.users
      SET phone = existing_phone
      WHERE id = NEW.id;
    END IF;
  ELSE
    INSERT INTO public.users (
      auth_id,
      email,
      first_name,
      last_name,
      major,
      expected_graduation,
      uh_id
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(meta_first, ''),
      COALESCE(meta_last, ''),
      COALESCE(meta_major, ''),
      COALESCE(meta_grad, ''),
      meta_uh_id
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_link"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user_link"() IS 'After auth.users insert: link or create public.users; apply signup metadata (first_name, last_name, major, expected_graduation, uh_id).';



CREATE OR REPLACE FUNCTION "public"."handle_unassigned_attendance_became_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_unassigned_attendance_became_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("perm_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.users u

        -- Check role-based permissions
        LEFT JOIN public.role_permissions rp ON rp.role_id = (
            SELECT role_id FROM public.users WHERE id = u.id
        )
        LEFT JOIN public.permissions rp_perm ON rp.permission_id = rp_perm.id

        -- Check position-based permissions
        LEFT JOIN public.user_positions up ON up.user_id = u.id
        LEFT JOIN public.positions pos ON up."positionTitle" = pos.title
        LEFT JOIN public.position_permissions pp ON pp.position_id = pos.id
        LEFT JOIN public.permissions pp_perm ON pp.permission_id = pp_perm.id

        WHERE u.auth_id = auth.uid()
        AND (
            rp_perm.name  = perm_name
            OR pp_perm.name = perm_name
            OR pos.is_admin = TRUE  -- admins get everything
        )
    );
END;
$$;


ALTER FUNCTION "public"."has_permission"("perm_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_event_attendance_from_json"("p_event_id" bigint, "p_attendees" "jsonb") RETURNS TABLE("inserted_events_attendance" integer, "inserted_unassigned" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."import_event_attendance_from_json"("p_event_id" bigint, "p_attendees" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."import_event_attendance_from_json"("p_event_id" bigint, "p_attendees" "jsonb") IS 'Bulk import attendance: inserts known members into events_attendance, unknown into unassigned_attendance. Requires manage_events.';



CREATE OR REPLACE FUNCTION "public"."list_forms_for_opportunity_linking"() RETURNS TABLE("id" "uuid", "title" "text", "status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT f.id, f.title, f.status
  FROM public.forms f
  WHERE public.current_user_has_permission('manage_opportunities')
     OR public.current_user_has_permission('manage_forms')
  ORDER BY f.title;
$$;


ALTER FUNCTION "public"."list_forms_for_opportunity_linking"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."list_forms_for_opportunity_linking"() IS 'Lists all forms (any status) for the opportunity-linking picker. Permission-gated inside the function since it is SECURITY DEFINER.';



CREATE OR REPLACE FUNCTION "public"."membership_tables_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."membership_tables_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_form_published"("p_form_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.notifications (user_id, type, title, link)
  select distinct
    u.id,
    'form_published',
    'New form: ' || f.title,
    '/dashboard/forms'
  from public.forms f
  join public.users u on u.auth_id is not null
  left join public.user_positions up
    on up.user_id = u.id and up.is_active is true
  left join public.positions pos
    on pos.title = up."positionTitle"
  where f.id = p_form_id
    and f.status = 'published'
    and f.is_active = true
    and f.notifications_sent_at is null
    and (
      f.audience_type = 'everyone'
      or (
        f.audience_type = 'roles'
        and exists (
          select 1 from public.form_audience_roles far
          where far.form_id = f.id and far.role_id = pos.role_id
        )
      )
      or (
        f.audience_type = 'positions'
        and exists (
          select 1 from public.form_audience_positions fap
          where fap.form_id = f.id and fap.position_id = pos.id
        )
      )
    );

  update public.forms
  set notifications_sent_at = now()
  where id = p_form_id
    and status = 'published'
    and is_active = true
    and notifications_sent_at is null;
end;
$$;


ALTER FUNCTION "public"."notify_form_published"("p_form_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_form_published"("p_form_id" "uuid") IS 'Fans out a notification, once, to whoever is in a published form''s audience (everyone/roles/positions) — mirrors public.current_user_can_view_form(). Safe to call unconditionally after any mutation.';



CREATE OR REPLACE FUNCTION "public"."notify_new_opportunity"("p_opportunity_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select
    u.id,
    'opportunity_posted',
    'New opportunity: ' || o.title,
    o.company_name,
    '/dashboard/opportunities'
  from public.opportunities o
  join public.users u on u.auth_id is not null
  where o.id = p_opportunity_id
    and o.notify_members = true
    and o.is_active = true
    and (o.expires_at is null or o.expires_at > now())
    and o.notified_at is null;

  update public.opportunities
  set notified_at = now()
  where id = p_opportunity_id
    and notify_members = true
    and is_active = true
    and (expires_at is null or expires_at > now())
    and notified_at is null;
end;
$$;


ALTER FUNCTION "public"."notify_new_opportunity"("p_opportunity_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_new_opportunity"("p_opportunity_id" "uuid") IS 'Fans out a notification to every account for an opportunity, once, when notify_members is on and it is actually visible (is_active, not expired). Safe to call unconditionally after any mutation.';



CREATE OR REPLACE FUNCTION "public"."populate_payments_from_users"() RETURNS TABLE("inserted_count" integer, "skipped_count" integer, "error_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    user_record RECORD;
    payment_count INTEGER := 0;
    skipped INTEGER := 0;
    errors INTEGER := 0;
    payment_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Loop through all users who have paid=true
    FOR user_record IN 
        SELECT 
            id,
            membership,
            paid,
            created,
            updated
        FROM users
        WHERE paid = true
        ORDER BY created ASC  -- Process oldest first
    LOOP
        BEGIN
            -- Check if payment already exists for this user
            IF NOT EXISTS (
                SELECT 1 FROM payments WHERE user_id = user_record.id
            ) THEN
                -- Determine the payment date (prefer created, fallback to updated, then now)
                payment_date := COALESCE(
                    user_record.created AT TIME ZONE 'UTC',
                    user_record.updated AT TIME ZONE 'UTC',
                    NOW() AT TIME ZONE 'UTC'
                );
                
                -- Insert payment record
                INSERT INTO payments (
                    user_id,
                    stripe_payment_intent_id,
                    status,
                    payment_type,
                    created_at,
                    amount
                ) VALUES (
                    user_record.id,
                    -- Generate a unique stripe_payment_intent_id
                    -- Format: 'migrated_' || user_id || '_' || epoch_timestamp
                    'migrated_' || user_record.id::text || '_' || 
                    EXTRACT(EPOCH FROM payment_date)::bigint::text,
                    'completed', -- Set status to completed since paid=true
                    user_record.membership, -- Use membership type as payment_type (Yearly/Semester)
                    payment_date,
                    NULL -- Amount is not available in users table, set to NULL
                );
                
                payment_count := payment_count + 1;
            ELSE
                skipped := skipped + 1;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but continue processing
                errors := errors + 1;
                RAISE WARNING 'Error processing user %: %', user_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT payment_count, skipped, errors;
END;
$$;


ALTER FUNCTION "public"."populate_payments_from_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_stripe_event"("p_event_id" "text", "p_type" "text", "p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_inserted_id uuid;
  v_object jsonb;
  v_metadata jsonb;
  v_checkout_session_id text;
  v_payment_intent_id text;
  v_plan_id uuid;
  v_user_id uuid;
  v_payment_id uuid;
  v_existing_membership_id uuid;
  v_plan public.membership_plans%rowtype;
  v_period_start date;
  v_period_end date;
  v_new_membership_id uuid;
begin
  insert into public.stripe_events (stripe_event_id, type, payload)
  values (p_event_id, p_type, p_payload)
  on conflict (stripe_event_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    -- Already processed this event id.
    return;
  end if;

  v_object := p_payload -> 'data' -> 'object';

  begin
    if p_type = 'checkout.session.completed' then
      v_checkout_session_id := v_object ->> 'id';
      v_payment_intent_id := v_object ->> 'payment_intent';
      v_metadata := v_object -> 'metadata';
      v_plan_id := nullif(v_metadata ->> 'plan_id', '')::uuid;

      update public.payments
      set status = 'succeeded',
          stripe_payment_intent_id = coalesce(stripe_payment_intent_id, v_payment_intent_id)
      where stripe_checkout_session_id = v_checkout_session_id
      returning id, membership_id into v_payment_id, v_existing_membership_id;

      if v_payment_id is not null and v_existing_membership_id is null and v_plan_id is not null then
        select * into v_plan from public.membership_plans where id = v_plan_id;

        if found then
          v_period_start := null;
          v_period_end := null;

          if v_plan.kind = 'semester' then
            select start_date, end_date into v_period_start, v_period_end
            from public.semesters where id = v_plan.semester_id;
          else
            select start_date, end_date into v_period_start, v_period_end
            from public.academic_years where id = v_plan.academic_year_id;
          end if;

          if v_period_start is not null and v_period_end is not null then
            insert into public.memberships (user_id, plan_id, status, starts_at, ends_at, payment_id)
            select p.user_id, v_plan.id, 'active', v_period_start, v_period_end, p.id
            from public.payments p
            where p.id = v_payment_id
            returning id into v_new_membership_id;

            update public.payments set membership_id = v_new_membership_id where id = v_payment_id;
          end if;
        end if;
      end if;

    elsif p_type = 'payment_intent.payment_failed' then
      v_payment_intent_id := v_object ->> 'id';
      v_metadata := v_object -> 'metadata';
      v_user_id := nullif(v_metadata ->> 'user_id', '')::uuid;
      v_plan_id := nullif(v_metadata ->> 'plan_id', '')::uuid;

      update public.payments
      set status = 'failed',
          stripe_payment_intent_id = coalesce(stripe_payment_intent_id, v_payment_intent_id)
      where user_id = v_user_id
        and plan_id = v_plan_id
        and status = 'pending';

    elsif p_type = 'charge.refunded' then
      -- Refund policy: let the paid period run out rather than revoking
      -- membership immediately (plan doc Section 11, confirmed decision).
      -- Only the payment's own status changes here.
      v_payment_intent_id := v_object ->> 'payment_intent';
      update public.payments
      set status = 'refunded'
      where stripe_payment_intent_id = v_payment_intent_id;

    elsif p_type = 'payment_intent.succeeded' then
      -- Secondary confirmation only; checkout.session.completed is the
      -- primary trigger and already marks the payment succeeded. No-op here,
      -- kept purely for the stripe_events audit trail.
      null;
    end if;

    update public.stripe_events
    set status = 'processed', processed_at = now()
    where id = v_inserted_id;
  exception when others then
    update public.stripe_events
    set status = 'failed', error = sqlerrm, processed_at = now()
    where id = v_inserted_id;
  end;
end;
$$;


ALTER FUNCTION "public"."process_stripe_event"("p_event_id" "text", "p_type" "text", "p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_stripe_event"("p_event_id" "text", "p_type" "text", "p_payload" "jsonb") IS 'Webhook dispatch for membership Stripe events. Idempotent on stripe_events.stripe_event_id. Call only via the service-role client.';



CREATE OR REPLACE FUNCTION "public"."recompute_leaderboard_on_year_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_current_year_id uuid;
begin
  -- Only the row that becomes current triggers a recompute; the "clear the
  -- old current row" update (is_current true -> false) is a no-op here.
  if new.is_current is not true then
    return new;
  end if;

  select id into v_current_year_id from public.academic_years where is_current = true limit 1;

  -- Reset total_points to the new year's sum (0 if none yet) for every user
  -- who already has a leaderboard row, plus anyone who already has
  -- point_transactions in the new year but no leaderboard row yet.
  insert into public.leaderboard (user_id, total_points)
  select
    u.id,
    coalesce(sum(pt.points_earned) filter (where pt.academic_year_id = v_current_year_id), 0)
  from public.users u
  left join public.point_transactions pt on pt.user_id = u.id
  where u.id in (select user_id from public.leaderboard)
     or u.id in (
       select user_id from public.point_transactions where academic_year_id = v_current_year_id
     )
  group by u.id
  on conflict (user_id) do update set total_points = excluded.total_points;

  update public.leaderboard lb
  set current_rank = sub.new_rank::integer,
      points_tie_group_size = sub.tie_cnt::integer
  from (
    select user_id,
      rank() over (order by total_points desc nulls last, user_id) as new_rank,
      count(*) over (partition by total_points) as tie_cnt
    from public.leaderboard
  ) as sub
  where lb.user_id = sub.user_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."recompute_leaderboard_on_year_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_position_permissions_from_role"("p_position_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  rid bigint;
BEGIN
  SELECT p.role_id INTO rid
  FROM public.positions p
  WHERE p.id = p_position_id;

  IF rid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.position_permissions (position_id, permission_id)
  SELECT p_position_id, rp.permission_id
  FROM public.role_permissions rp
  WHERE rp.role_id = rid
    AND rp.permission_id IS NOT NULL
  ON CONFLICT (position_id, permission_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."refresh_position_permissions_from_role"("p_position_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_position_permissions_from_role"("p_position_id" bigint) IS 'Inserts missing position_permissions rows for this position based on role_permissions for positions.role_id.';



CREATE OR REPLACE FUNCTION "public"."reset_team_rosters_on_year_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.is_current is not true then
    return new;
  end if;

  delete from public.teams_members;
  delete from public.teams_leads;

  return new;
end;
$$;


ALTER FUNCTION "public"."reset_team_rosters_on_year_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resources_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."resources_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."semesters_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."semesters_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_transaction_points"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    -- Look up the point value from the category table if not provided
    if new.points_earned is null then
        select points_value into new.points_earned
        from public.point_categories
        where id = new.category_id;
    end if;

    -- Fallback safety
    if new.points_earned is null then
        new.points_earned := 0;
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."set_transaction_points"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_transaction_points_and_year"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
    active_year_id uuid;
    event_points int;
begin
    -- 1. Automatically grab the current active academic year
    select id into active_year_id from public.academic_years where is_current = true limit 1;
    new.academic_year_id := active_year_id;

    -- 2. Logic Hierarchy for Points Earned
    -- Priority 1: Manual Override (If admin provided points_earned, do nothing)
    if new.points_earned is not null then
        return new;
    end if;

    -- Priority 2: Event-Specific Points
    if new.event_id is not null then
        select points_awarded into event_points from public.events where id = new.event_id;
        if event_points is not null then
            new.points_earned := event_points;
            return new;
        end if;
    end if;

    -- Priority 3: Category Default Points
    if new.category_id is not null then
        select points_value into new.points_earned 
        from public.point_categories 
        where id = new.category_id;
    end if;

    -- Fallback
    if new.points_earned is null then
        new.points_earned := 0;
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."set_transaction_points_and_year"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_avatar"("p_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.users
  SET
    avatar_url = NULLIF(trim(p_url), ''),
    updated = now()
  WHERE auth_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'No profile row for this user';
  END IF;
END;
$$;


ALTER FUNCTION "public"."set_user_avatar"("p_url" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_user_avatar"("p_url" "text") IS 'Sets public.users.avatar_url for the current auth user. Clients upload to Storage first, then pass the public URL.';



CREATE OR REPLACE FUNCTION "public"."sync_my_signup_profile_from_auth"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text;
  v_meta jsonb;
  meta_first text;
  meta_last text;
  meta_major text;
  meta_grad text;
  meta_uh_id text;
  n int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT u.email, u.raw_user_meta_data
  INTO v_email, v_meta
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  meta_first := NULLIF(trim(COALESCE(v_meta->>'first_name', '')), '');
  meta_last := NULLIF(trim(COALESCE(v_meta->>'last_name', '')), '');
  meta_major := NULLIF(trim(COALESCE(v_meta->>'major', '')), '');
  meta_grad := NULLIF(trim(COALESCE(v_meta->>'expected_graduation', '')), '');
  meta_uh_id := NULLIF(trim(COALESCE(v_meta->>'uh_id', '')), '');

  UPDATE public.users
  SET
    auth_id = auth.uid(),
    first_name = COALESCE(meta_first, first_name),
    last_name = COALESCE(meta_last, last_name),
    major = COALESCE(meta_major, major),
    expected_graduation = COALESCE(meta_grad, expected_graduation),
    uh_id = COALESCE(meta_uh_id, uh_id),
    updated = now()
  WHERE auth_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 AND v_email IS NOT NULL AND length(trim(v_email)) > 0 THEN
    UPDATE public.users
    SET
      auth_id = auth.uid(),
      first_name = COALESCE(meta_first, first_name),
      last_name = COALESCE(meta_last, last_name),
      major = COALESCE(meta_major, major),
      expected_graduation = COALESCE(meta_grad, expected_graduation),
      uh_id = COALESCE(meta_uh_id, uh_id),
      updated = now()
    WHERE lower(trim(email)) = lower(trim(v_email));

    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;

  IF n = 0 THEN
    INSERT INTO public.users (
      auth_id,
      email,
      first_name,
      last_name,
      major,
      expected_graduation,
      uh_id
    )
    VALUES (
      auth.uid(),
      COALESCE(nullif(trim(v_email), ''), ''),
      COALESCE(meta_first, ''),
      COALESCE(meta_last, ''),
      COALESCE(meta_major, ''),
      COALESCE(meta_grad, ''),
      meta_uh_id
    )
    ON CONFLICT (email) DO UPDATE SET
      auth_id = EXCLUDED.auth_id,
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.users.first_name),
      last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), public.users.last_name),
      major = COALESCE(NULLIF(EXCLUDED.major, ''), public.users.major),
      expected_graduation = COALESCE(
        NULLIF(EXCLUDED.expected_graduation, ''),
        public.users.expected_graduation
      ),
      uh_id = COALESCE(EXCLUDED.uh_id, public.users.uh_id),
      updated = now();
  END IF;
END;
$$;


ALTER FUNCTION "public"."sync_my_signup_profile_from_auth"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_my_signup_profile_from_auth"() IS 'Upserts public.users from auth.raw_user_meta_data (first_name, last_name, major, expected_graduation, uh_id) for the current user.';



CREATE OR REPLACE FUNCTION "public"."sync_oauth_profile_to_public_user"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_discord jsonb;
  v_provider_id text;
  avatar text;
  disp_name text;
  global_name text;
  fn text;
  ln text;
  disc text;
  n int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT u.email, u.raw_user_meta_data
  INTO v_email, v_meta
  FROM auth.users u
  WHERE u.id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  SELECT i.identity_data, i.provider_id::text
  INTO v_discord, v_provider_id
  FROM auth.identities i
  WHERE i.user_id = v_uid AND i.provider = 'discord'
  ORDER BY i.created_at DESC
  LIMIT 1;

  avatar := NULLIF(trim(COALESCE(
    v_discord->>'avatar_url',
    v_discord->>'picture',
    v_meta->>'avatar_url',
    v_meta->>'picture',
    ''
  )), '');

  global_name := NULLIF(trim(COALESCE(
    v_meta #>> '{custom_claims,global_name}',
    v_discord #>> '{custom_claims,global_name}',
    ''
  )), '');

  disp_name := NULLIF(trim(COALESCE(
    global_name,
    v_discord->>'full_name',
    v_meta->>'full_name',
    v_discord->>'name',
    v_meta->>'name',
    ''
  )), '');

  IF disp_name IS NOT NULL AND strpos(disp_name, ' ') > 0 THEN
    fn := split_part(disp_name, ' ', 1);
    ln := NULLIF(trim(substring(disp_name from length(fn) + 2)), '');
  ELSIF disp_name IS NOT NULL THEN
    fn := disp_name;
    ln := '';
  ELSE
    fn := NULLIF(trim(COALESCE(v_meta->>'given_name', v_meta->>'first_name', '')), '');
    ln := NULLIF(trim(COALESCE(v_meta->>'family_name', v_meta->>'last_name', '')), '');
  END IF;

  disc := NULLIF(trim(COALESCE(
    v_discord->>'preferred_username',
    v_discord->>'username',
    global_name,
    disp_name,
    NULLIF(trim(COALESCE(v_provider_id, '')), ''),
    ''
  )), '');

  UPDATE public.users
  SET
    auth_id = v_uid,
    first_name = COALESCE(NULLIF(trim(first_name), ''), NULLIF(fn, ''), first_name),
    last_name = COALESCE(NULLIF(trim(last_name), ''), NULLIF(ln, ''), last_name),
    avatar_url = COALESCE(NULLIF(trim(avatar_url), ''), NULLIF(avatar, ''), avatar_url),
    discord = COALESCE(NULLIF(trim(discord), ''), NULLIF(disc, ''), discord),
    updated = now()
  WHERE auth_id = v_uid;

  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 AND v_email IS NOT NULL AND length(trim(v_email)) > 0 THEN
    UPDATE public.users
    SET
      auth_id = v_uid,
      first_name = COALESCE(NULLIF(trim(first_name), ''), NULLIF(fn, ''), first_name),
      last_name = COALESCE(NULLIF(trim(last_name), ''), NULLIF(ln, ''), last_name),
      avatar_url = COALESCE(NULLIF(trim(avatar_url), ''), NULLIF(avatar, ''), avatar_url),
      discord = COALESCE(NULLIF(trim(discord), ''), NULLIF(disc, ''), discord),
      updated = now()
    WHERE lower(trim(email)) = lower(trim(v_email));

    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;

  IF n = 0 THEN
    INSERT INTO public.users (
      auth_id,
      email,
      first_name,
      last_name,
      major,
      expected_graduation,
      avatar_url,
      discord
    )
    VALUES (
      v_uid,
      COALESCE(nullif(trim(v_email), ''), ''),
      COALESCE(fn, ''),
      COALESCE(ln, ''),
      '',
      '',
      NULLIF(avatar, ''),
      NULLIF(disc, '')
    )
    ON CONFLICT (email) DO UPDATE SET
      auth_id = EXCLUDED.auth_id,
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.users.first_name),
      last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), public.users.last_name),
      avatar_url = COALESCE(
        NULLIF(trim(public.users.avatar_url), ''),
        NULLIF(EXCLUDED.avatar_url, ''),
        public.users.avatar_url
      ),
      discord = COALESCE(
        NULLIF(trim(public.users.discord), ''),
        NULLIF(EXCLUDED.discord, ''),
        public.users.discord
      ),
      updated = now();
  END IF;
END;
$$;


ALTER FUNCTION "public"."sync_oauth_profile_to_public_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_oauth_profile_to_public_user"() IS 'Upserts public.users for the current auth user using Discord identity_data and OAuth user_metadata (name, avatar_url, discord handle). Fills empty fields only on UPDATE.';



CREATE OR REPLACE FUNCTION "public"."sync_points_on_event_category_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_new_category_id uuid;
  v_new_points_value integer;
BEGIN
  -- Only act if point_category actually changed
  IF NEW.point_category IS NOT DISTINCT FROM OLD.point_category THEN
    RETURN NEW;
  END IF;

  -- Look up the new category
  SELECT id, points_value
  INTO v_new_category_id, v_new_points_value
  FROM point_categories
  WHERE name = NEW.point_category;

  -- If new category doesn't resolve (e.g. set to NULL), nullify transactions
  UPDATE point_transactions
  SET
    category_id    = v_new_category_id,
    points_earned  = v_new_points_value,
    updated_at     = now()
  WHERE event_id = NEW.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_points_on_event_category_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tickets_set_updated_on"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_on = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."tickets_set_updated_on"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_positions_after_insert_update_role_permissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_position_permissions_from_role(NEW.id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
      PERFORM public.refresh_position_permissions_from_role(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_positions_after_insert_update_role_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_role_permissions_mirror_to_positions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.position_permissions pp
    USING public.positions pos
    WHERE pp.position_id = pos.id
      AND OLD.role_id IS NOT NULL
      AND pos.role_id = OLD.role_id
      AND pp.permission_id = OLD.permission_id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.position_permissions (position_id, permission_id)
    SELECT pos.id, NEW.permission_id
    FROM public.positions pos
    WHERE NEW.role_id IS NOT NULL
      AND pos.role_id = NEW.role_id
    ON CONFLICT (position_id, permission_id) DO NOTHING;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.position_permissions pp
    USING public.positions pos
    WHERE pp.position_id = pos.id
      AND OLD.role_id IS NOT NULL
      AND pos.role_id = OLD.role_id
      AND pp.permission_id = OLD.permission_id;

    INSERT INTO public.position_permissions (position_id, permission_id)
    SELECT pos.id, NEW.permission_id
    FROM public.positions pos
    WHERE NEW.role_id IS NOT NULL
      AND pos.role_id = NEW.role_id
    ON CONFLICT (position_id, permission_id) DO NOTHING;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trg_role_permissions_mirror_to_positions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_user_positions_try_link_auth_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.try_link_public_user_auth_id(NEW.user_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_user_positions_try_link_auth_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_users_try_link_auth_after_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.auth_id IS NULL THEN
      PERFORM public.try_link_public_user_auth_id(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.auth_id IS NULL
      AND (
        OLD.email IS DISTINCT FROM NEW.email
        OR OLD.auth_id IS DISTINCT FROM NEW.auth_id
      ) THEN
      PERFORM public.try_link_public_user_auth_id(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_users_try_link_auth_after_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_link_public_user_auth_id"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text;
  v_auth uuid;
BEGIN
  SELECT nullif(trim(u.email), '')
  INTO v_email
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  SELECT au.id
  INTO v_auth
  FROM auth.users au
  WHERE nullif(trim(au.email), '') IS NOT NULL
    AND lower(au.email) = lower(v_email)
  ORDER BY au.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_auth IS NOT NULL THEN
    UPDATE public.users u
    SET
      auth_id = v_auth,
      updated = now()
    WHERE u.id = p_user_id
      AND u.auth_id IS NULL;
  END IF;
END;
$$;


ALTER FUNCTION "public"."try_link_public_user_auth_id"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."try_link_public_user_auth_id"("p_user_id" "uuid") IS 'Sets public.users.auth_id from auth.users when still NULL (match by lower(trim(email))); latest auth row wins.';



CREATE OR REPLACE FUNCTION "public"."update_leaderboard_ranks"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_year_id uuid;
BEGIN
  SELECT id INTO current_year_id
  FROM public.academic_years
  WHERE is_current = true
  LIMIT 1;

  INSERT INTO public.leaderboard (user_id, total_points)
  VALUES (
    NEW.user_id,
    (
      SELECT coalesce(sum(points_earned), 0)
      FROM public.point_transactions
      WHERE user_id = NEW.user_id
        AND academic_year_id = current_year_id
    )
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = (
      SELECT coalesce(sum(points_earned), 0)
      FROM public.point_transactions
      WHERE user_id = NEW.user_id
        AND academic_year_id = current_year_id
    );

  UPDATE public.leaderboard lb
  SET
    current_rank = sub.new_rank::integer,
    points_tie_group_size = sub.tie_cnt::integer
  FROM (
    SELECT
      user_id,
      rank() OVER (
        ORDER BY total_points DESC NULLS LAST,
          user_id
      ) AS new_rank,
      count(*) OVER (PARTITION BY total_points) AS tie_cnt
    FROM public.leaderboard
  ) AS sub
  WHERE lb.user_id = sub.user_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_leaderboard_ranks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_profile"("p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_classification" "text", "p_expected_graduation" "text", "p_major" "text", "p_uh_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.users
  SET
    first_name = COALESCE(NULLIF(trim(p_first_name), ''), first_name),
    last_name = COALESCE(NULLIF(trim(p_last_name), ''), last_name),
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    classification = COALESCE(NULLIF(trim(p_classification), ''), classification),
    expected_graduation = COALESCE(NULLIF(trim(p_expected_graduation), ''), expected_graduation),
    major = NULLIF(trim(p_major), ''),
    uh_id = COALESCE(NULLIF(trim(p_uh_id), ''), uh_id),
    updated = now()
  WHERE auth_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'No profile row for this user';
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_my_profile"("p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_classification" "text", "p_expected_graduation" "text", "p_major" "text", "p_uh_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_my_profile"("p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_classification" "text", "p_expected_graduation" "text", "p_major" "text", "p_uh_id" "text") IS 'Updates public.users fields for the current auth user (auth_id = auth.uid()), including uh_id.';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academic_years" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "is_current" boolean DEFAULT false,
    "start_date" "date",
    "end_date" "date",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."academic_years" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opportunities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "link_url" "text",
    "category" "text",
    "icon_url" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "company_name" "text",
    "location" "text",
    "employment_type" "text",
    "salary" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "external_id" "text",
    "field" "text",
    "notify_members" boolean DEFAULT false NOT NULL,
    "notified_at" timestamp with time zone,
    "linked_form_id" "uuid",
    "website_viewable" boolean DEFAULT false NOT NULL,
    "term" "text",
    "opens_on" "date",
    "closes_on" "date",
    CONSTRAINT "opportunities_category_check" CHECK (("category" = ANY (ARRAY['Internship'::"text", 'Club Role'::"text", 'Project'::"text", 'Sponsor'::"text", 'Job'::"text", 'Other'::"text"]))),
    CONSTRAINT "opportunities_employment_type_check" CHECK ((("employment_type" IS NULL) OR ("employment_type" = ANY (ARRAY['Full-time'::"text", 'Part-time'::"text", 'Internship'::"text", 'Contract'::"text"])))),
    CONSTRAINT "opportunities_link_target_chk" CHECK ((("link_url" IS NOT NULL) <> ("linked_form_id" IS NOT NULL))),
    CONSTRAINT "opportunities_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'csv_import'::"text"])))
);


ALTER TABLE "public"."opportunities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."opportunities"."company_name" IS 'Employer name for job-shaped opportunities; blank for Club Role/Project/Sponsor cards.';



COMMENT ON COLUMN "public"."opportunities"."employment_type" IS 'Full-time/Part-time/Internship/Contract. Only meaningful when the card represents a job posting.';



COMMENT ON COLUMN "public"."opportunities"."source" IS 'manual (admin-entered) or csv_import (bulk-imported, e.g. from a LinkedIn export).';



COMMENT ON COLUMN "public"."opportunities"."external_id" IS 'Dedup key for re-imports, e.g. the source CSV''s linkedin_job_id. NULL for manual entries.';



COMMENT ON COLUMN "public"."opportunities"."field" IS 'Discipline/search-keyword tag from a CSV import (e.g. "Data Science"). Distinct from category, which is the card-type bucket.';



COMMENT ON COLUMN "public"."opportunities"."website_viewable" IS 'Whether this opportunity may be shown on the public website. Distinct from is_active, which is whether it is live in the admin app at all.';



COMMENT ON COLUMN "public"."opportunities"."term" IS 'Human-readable application window shown on the website card (e.g. "Spring 2026").';



CREATE OR REPLACE VIEW "public"."active_opportunities" WITH ("security_invoker"='on') AS
 SELECT "id",
    "title",
    "description",
    "link_url",
    "category",
    "icon_url",
    "is_active",
    "display_order",
    "expires_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "company_name",
    "location",
    "employment_type",
    "salary",
    "source",
    "external_id",
    "field",
    "linked_form_id",
    ("linked_form_id" IS NOT NULL) AS "is_internal",
    "website_viewable",
    "term",
    "opens_on",
    "closes_on"
   FROM "public"."opportunities"
  WHERE (("is_active" = true) AND (("expires_at" IS NULL) OR ("expires_at" > "now"())))
  ORDER BY ("linked_form_id" IS NOT NULL) DESC, "display_order";


ALTER VIEW "public"."active_opportunities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" bigint NOT NULL,
    "name" character varying DEFAULT ''::character varying NOT NULL,
    "description" "text" DEFAULT 'Please add description'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT "gen_random_uuid"(),
    "updated_by" "uuid" DEFAULT "gen_random_uuid"(),
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


ALTER TABLE "public"."branches" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."branches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."deleted_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "auth_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "deletion_requested_at" timestamp with time zone NOT NULL,
    "deletion_confirmed_at" timestamp with time zone,
    "deletion_completed_at" timestamp with time zone,
    "backup_exported" boolean DEFAULT false,
    "backup_export_requested_at" timestamp with time zone,
    "restored_at" timestamp with time zone,
    "restored_by_user_id" "uuid",
    "deletion_reason" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "deleted_users_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'purged'::"text", 'restored'::"text"])))
);


ALTER TABLE "public"."deleted_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."deleted_users" IS 'Audit trail for deleted user accounts. Required for IRS tax-exempt compliance and legal records retention.';



COMMENT ON COLUMN "public"."deleted_users"."status" IS 'pending: deletion requested, confirmed: user confirmed via email, purged: data removed after 30 days, restored: account restored by admin';



CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" bigint NOT NULL,
    "google_event_id" "text",
    "start_time" timestamp with time zone,
    "location" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "end_time" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "point_category" "text",
    "flyer_url" "text",
    "is_public" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."point_category" IS 'this is the category we are assigning to the event';



COMMENT ON COLUMN "public"."events"."flyer_url" IS 'The flyer url to load in the image';



COMMENT ON COLUMN "public"."events"."status" IS 'This is the status of the event i.e. wether or not the event is cancelled etc.';



CREATE TABLE IF NOT EXISTS "public"."events_attendance" (
    "event_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attended_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."events_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events_attending" (
    "event_id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."events_attending" OWNER TO "postgres";


ALTER TABLE "public"."events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."finance_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "external_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_accounts_type_check" CHECK (("type" = ANY (ARRAY['stripe_memberships'::"text", 'stripe_sponsors'::"text", 'tdecu_manual'::"text"])))
);


ALTER TABLE "public"."finance_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "academic_year_id" "uuid" NOT NULL,
    "planned_amount_cents" bigint NOT NULL,
    "notes" "text",
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "created_on" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_on" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_budgets_planned_amount_non_negative" CHECK (("planned_amount_cents" >= 0))
);


ALTER TABLE "public"."finance_budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_categories_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."finance_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_sponsors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_name" "text",
    "contact_email" "text",
    "stripe_customer_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_sponsors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_stripe_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid",
    "stripe_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_stripe_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "direction" "text" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "description" "text",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "member_id" "uuid",
    "sponsor_id" "uuid",
    "source" "text" NOT NULL,
    "stripe_object_id" "text",
    "receipt_path" "text",
    "status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_on" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_on" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_transactions_amount_positive" CHECK (("amount_cents" > 0)),
    CONSTRAINT "finance_transactions_direction_check" CHECK (("direction" = ANY (ARRAY['income'::"text", 'expense'::"text"]))),
    CONSTRAINT "finance_transactions_manual_requires_created_by" CHECK ((("source" <> 'manual'::"text") OR ("created_by" IS NOT NULL))),
    CONSTRAINT "finance_transactions_source_check" CHECK (("source" = ANY (ARRAY['stripe'::"text", 'manual'::"text"]))),
    CONSTRAINT "finance_transactions_status_check" CHECK (("status" = ANY (ARRAY['unverified'::"text", 'verified'::"text"])))
);


ALTER TABLE "public"."finance_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_audience_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "position_id" bigint NOT NULL
);


ALTER TABLE "public"."form_audience_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_audience_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "role_id" bigint NOT NULL
);


ALTER TABLE "public"."form_audience_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_question_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."form_question_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "help_text" "text",
    "is_required" boolean DEFAULT false NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "autofill_source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "form_questions_autofill_source_check" CHECK ((("autofill_source" IS NULL) OR ("autofill_source" = ANY (ARRAY['first_name'::"text", 'last_name'::"text", 'email'::"text", 'phone'::"text", 'classification'::"text", 'expected_graduation'::"text", 'major'::"text", 'discord'::"text"])))),
    CONSTRAINT "form_questions_type_check" CHECK (("type" = ANY (ARRAY['short_answer'::"text", 'paragraph'::"text", 'single_select'::"text", 'multi_select'::"text", 'dropdown'::"text", 'date'::"text", 'file_upload'::"text"])))
);


ALTER TABLE "public"."form_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_response_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "response_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "value" "text",
    "selected_option_ids" "uuid"[],
    "file_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."form_response_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "respondent_id" "uuid" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."form_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "audience_type" "text" DEFAULT 'everyone'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notifications_sent_at" timestamp with time zone,
    CONSTRAINT "forms_audience_type_check" CHECK (("audience_type" = ANY (ARRAY['everyone'::"text", 'roles'::"text", 'positions'::"text"]))),
    CONSTRAINT "forms_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."forms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaderboard" (
    "user_id" "uuid" NOT NULL,
    "total_points" integer DEFAULT 0,
    "current_rank" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "points_tie_group_size" integer
);


ALTER TABLE "public"."leaderboard" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leaderboard"."points_tie_group_size" IS 'How many members share this total_points (same tie cohort as rank()); 1 = sole place at this score.';



CREATE TABLE IF NOT EXISTS "public"."leaderboards_teams" (
    "leaderboard_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rank" bigint NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."leaderboards_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membership_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "stripe_price_id" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "semester_id" "uuid",
    "academic_year_id" "uuid",
    CONSTRAINT "membership_plans_amount_positive" CHECK (("amount_cents" > 0)),
    CONSTRAINT "membership_plans_kind_check" CHECK (("kind" = ANY (ARRAY['semester'::"text", 'yearly'::"text"]))),
    CONSTRAINT "membership_plans_period_matches_kind" CHECK (((("kind" = 'semester'::"text") AND ("semester_id" IS NOT NULL) AND ("academic_year_id" IS NULL)) OR (("kind" = 'yearly'::"text") AND ("academic_year_id" IS NOT NULL) AND ("semester_id" IS NULL))))
);


ALTER TABLE "public"."membership_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "starts_at" "date" NOT NULL,
    "ends_at" "date" NOT NULL,
    "payment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "memberships_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'expired'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "link" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."officer_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bio" "text",
    "linkedin_url" "text",
    "instagram_url" "text",
    "personal_site_url" "text",
    "photo_url" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "user_id" "uuid",
    "officer_role" "uuid" NOT NULL,
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."officer_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."officer_profiles" IS 'officers can update thair profiles without changing the users table';



CREATE TABLE IF NOT EXISTS "public"."otp_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid" NOT NULL,
    "purpose" "text" NOT NULL,
    "code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "otp_codes_purpose_check" CHECK (("purpose" = ANY (ARRAY['signup'::"text", 'password_reset'::"text"])))
);


ALTER TABLE "public"."otp_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_payment_intent_id" "text",
    "status" "text",
    "payment_type" "text",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "amount" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "membership_id" "uuid",
    "plan_id" "uuid",
    "stripe_customer_id" "text",
    "stripe_checkout_session_id" "text",
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."point_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "points_value" integer NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."point_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."point_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "category_id" "uuid",
    "event_id" bigint,
    "points_earned" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "academic_year_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."point_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points" (
    "user_id" "uuid" NOT NULL,
    "points" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT "gen_random_uuid"(),
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."position_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "position_id" bigint,
    "permission_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."position_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT 'Enter description about position here'::"text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_on" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "branch_id" bigint,
    "role_id" bigint DEFAULT '3'::bigint,
    "is_admin" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


ALTER TABLE "public"."positions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."positions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


ALTER TABLE "public"."projects" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."projects_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "link_url" "text" NOT NULL,
    "extension" "text",
    "thumbnail_url" "text",
    "resource_date" "date",
    "display_order" integer DEFAULT 0 NOT NULL,
    "website_viewable" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "role_id" bigint,
    "permission_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."role_permissions" IS 'This is a duplicate of position_permissions';



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


ALTER TABLE "public"."roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."semesters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academic_year_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "term" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "is_current" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "semesters_dates_check" CHECK (("end_date" > "start_date")),
    CONSTRAINT "semesters_term_check" CHECK (("term" = ANY (ARRAY['fall'::"text", 'spring'::"text", 'summer'::"text"])))
);


ALTER TABLE "public"."semesters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "error" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "stripe_events_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'processed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" bigint,
    "title" "text" NOT NULL,
    "description" "text",
    "assigned_to" "uuid",
    "assigned_by" "uuid",
    "due_date" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'tasks that executives can assign other members';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "academic_year" "uuid",
    "team_number" bigint DEFAULT '0'::bigint NOT NULL,
    "description" "text" DEFAULT 'No description provided for this team :( '::"text",
    "team_image_url" "text",
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON COLUMN "public"."teams"."team_image_url" IS 'Public image URL shown on teams directory and my-team pages.';



CREATE TABLE IF NOT EXISTS "public"."teams_leads" (
    "team_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."teams_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams_members" (
    "team_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."teams_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "created_on" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_on" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unassigned_attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" bigint NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "discord" "text",
    "personal_email" "text",
    "cougarnet_email" "text",
    "phone_number" "text",
    "psid" "text",
    "is_user" boolean DEFAULT false NOT NULL,
    "attended_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "updated_by" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid"
);


ALTER TABLE "public"."unassigned_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "positionTitle" "text"
);


ALTER TABLE "public"."user_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "classification" "text" DEFAULT ''::"text" NOT NULL,
    "expected_graduation" "text" DEFAULT ''::"text" NOT NULL,
    "discord" "text",
    "major" "text",
    "membership" "text",
    "paid" boolean DEFAULT false NOT NULL,
    "shirt-bought" boolean,
    "created" timestamp without time zone DEFAULT "now"(),
    "updated" timestamp without time zone DEFAULT "now"(),
    "auth_id" "uuid",
    "avatar_url" "text",
    "deleted_at" timestamp with time zone,
    "deletion_requested_at" timestamp with time zone,
    "uh_id" "text",
    CONSTRAINT "users_uh_id_format" CHECK ((("uh_id" IS NULL) OR ("uh_id" ~ '^[0-9]{7}$'::"text")))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."avatar_url" IS 'Public URL for the member profile image (Supabase Storage bucket avatars, path = auth user id / filename).';



CREATE OR REPLACE VIEW "public"."user_profile" AS
 SELECT "u"."auth_id",
    "up"."user_id",
    "up"."positionTitle",
    "r"."name" AS "role_name",
    "p"."is_admin",
    ( SELECT COALESCE("array_agg"(DISTINCT "sub"."pname"), ARRAY[]::"text"[]) AS "coalesce"
           FROM ( SELECT "perm"."name" AS "pname"
                   FROM ("public"."position_permissions" "pp2"
                     JOIN "public"."permissions" "perm" ON (("perm"."id" = "pp2"."permission_id")))
                  WHERE ("pp2"."position_id" = "p"."id")
                UNION
                 SELECT "perm2"."name"
                   FROM ("public"."role_permissions" "rp2"
                     JOIN "public"."permissions" "perm2" ON (("perm2"."id" = "rp2"."permission_id")))
                  WHERE (("p"."role_id" IS NOT NULL) AND ("rp2"."role_id" = "p"."role_id"))) "sub") AS "permissions"
   FROM ((("public"."user_positions" "up"
     JOIN "public"."users" "u" ON (("u"."id" = "up"."user_id")))
     JOIN "public"."positions" "p" ON (("p"."title" = "up"."positionTitle")))
     LEFT JOIN "public"."roles" "r" ON (("r"."id" = "p"."role_id")))
  WHERE ("up"."is_active" IS TRUE);


ALTER VIEW "public"."user_profile" OWNER TO "postgres";


COMMENT ON VIEW "public"."user_profile" IS 'Active assignments only (is_active not false): auth_id, user_id, position title, resolved role/is_admin when title matches positions, aggregated permission names.';



ALTER TABLE ONLY "public"."events_attending"
    ADD CONSTRAINT "Event_Attending_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."leaderboards_teams"
    ADD CONSTRAINT "Leaderboard_Team_pkey" PRIMARY KEY ("leaderboard_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams_leads"
    ADD CONSTRAINT "Team_Lead_pkey" PRIMARY KEY ("team_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deleted_users"
    ADD CONSTRAINT "deleted_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events_attendance"
    ADD CONSTRAINT "events_attendance_event_user_unique" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."events_attendance"
    ADD CONSTRAINT "events_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_type_key" UNIQUE ("google_event_id");



ALTER TABLE ONLY "public"."finance_accounts"
    ADD CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_budgets"
    ADD CONSTRAINT "finance_budgets_category_year_unique" UNIQUE ("category_id", "academic_year_id");



ALTER TABLE ONLY "public"."finance_budgets"
    ADD CONSTRAINT "finance_budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_categories"
    ADD CONSTRAINT "finance_categories_name_type_unique" UNIQUE ("name", "type");



ALTER TABLE ONLY "public"."finance_categories"
    ADD CONSTRAINT "finance_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_sponsors"
    ADD CONSTRAINT "finance_sponsors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_stripe_sync_log"
    ADD CONSTRAINT "finance_stripe_sync_log_event_id_unique" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."finance_stripe_sync_log"
    ADD CONSTRAINT "finance_stripe_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_audience_positions"
    ADD CONSTRAINT "form_audience_positions_form_position_unique" UNIQUE ("form_id", "position_id");



ALTER TABLE ONLY "public"."form_audience_positions"
    ADD CONSTRAINT "form_audience_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_audience_roles"
    ADD CONSTRAINT "form_audience_roles_form_role_unique" UNIQUE ("form_id", "role_id");



ALTER TABLE ONLY "public"."form_audience_roles"
    ADD CONSTRAINT "form_audience_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_question_options"
    ADD CONSTRAINT "form_question_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_questions"
    ADD CONSTRAINT "form_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_response_answers"
    ADD CONSTRAINT "form_response_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_response_answers"
    ADD CONSTRAINT "form_response_answers_response_question_unique" UNIQUE ("response_id", "question_id");



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_form_respondent_unique" UNIQUE ("form_id", "respondent_id");



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leaderboard"
    ADD CONSTRAINT "leaderboard_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."membership_plans"
    ADD CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_OfficerAssignment_key" UNIQUE ("officer_role");



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otp_codes"
    ADD CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payee_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE "public"."payments"
    ADD CONSTRAINT "payments_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['pending'::"text", 'succeeded'::"text", 'failed'::"text", 'refunded'::"text"])))) NOT VALID;



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."point_categories"
    ADD CONSTRAINT "point_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."point_categories"
    ADD CONSTRAINT "point_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_pkey" PRIMARY KEY ("user_id", "id");



ALTER TABLE ONLY "public"."position_permissions"
    ADD CONSTRAINT "position_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."position_permissions"
    ADD CONSTRAINT "position_permissions_position_id_permission_id_key" UNIQUE ("position_id", "permission_id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_title_key" UNIQUE ("title");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_position_id_permission_id_key" UNIQUE ("role_id", "permission_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_role_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."semesters"
    ADD CONSTRAINT "semesters_academic_year_term_unique" UNIQUE ("academic_year_id", "term");



ALTER TABLE ONLY "public"."semesters"
    ADD CONSTRAINT "semesters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_event_id_unique" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams_members"
    ADD CONSTRAINT "teams_members_pkey" PRIMARY KEY ("team_id", "user_id");



ALTER TABLE ONLY "public"."teams_members"
    ADD CONSTRAINT "teams_members_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unassigned_attendance"
    ADD CONSTRAINT "unassigned_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "users_roles_pkey" PRIMARY KEY ("id");



CREATE INDEX "finance_transactions_account_id_idx" ON "public"."finance_transactions" USING "btree" ("account_id");



CREATE INDEX "finance_transactions_category_id_idx" ON "public"."finance_transactions" USING "btree" ("category_id");



CREATE INDEX "finance_transactions_member_id_idx" ON "public"."finance_transactions" USING "btree" ("member_id");



CREATE INDEX "finance_transactions_occurred_at_idx" ON "public"."finance_transactions" USING "btree" ("occurred_at");



CREATE INDEX "finance_transactions_sponsor_id_idx" ON "public"."finance_transactions" USING "btree" ("sponsor_id");



CREATE UNIQUE INDEX "finance_transactions_stripe_object_id_unique" ON "public"."finance_transactions" USING "btree" ("stripe_object_id") WHERE ("stripe_object_id" IS NOT NULL);



CREATE INDEX "form_audience_positions_form_id_idx" ON "public"."form_audience_positions" USING "btree" ("form_id");



CREATE INDEX "form_audience_roles_form_id_idx" ON "public"."form_audience_roles" USING "btree" ("form_id");



CREATE INDEX "form_question_options_question_id_idx" ON "public"."form_question_options" USING "btree" ("question_id");



CREATE INDEX "form_questions_form_id_idx" ON "public"."form_questions" USING "btree" ("form_id");



CREATE INDEX "form_response_answers_question_id_idx" ON "public"."form_response_answers" USING "btree" ("question_id");



CREATE INDEX "form_response_answers_response_id_idx" ON "public"."form_response_answers" USING "btree" ("response_id");



CREATE INDEX "form_responses_form_id_idx" ON "public"."form_responses" USING "btree" ("form_id");



CREATE INDEX "form_responses_respondent_id_idx" ON "public"."form_responses" USING "btree" ("respondent_id");



CREATE INDEX "idx_deleted_users_deletion_completed_at" ON "public"."deleted_users" USING "btree" ("deletion_completed_at");



CREATE INDEX "idx_deleted_users_status" ON "public"."deleted_users" USING "btree" ("status");



CREATE INDEX "idx_deleted_users_user_id" ON "public"."deleted_users" USING "btree" ("user_id");



CREATE INDEX "idx_users_auth_id" ON "public"."users" USING "btree" ("auth_id");



CREATE INDEX "idx_users_deleted_at" ON "public"."users" USING "btree" ("deleted_at");



CREATE INDEX "idx_users_deletion_requested_at" ON "public"."users" USING "btree" ("deletion_requested_at");



CREATE INDEX "membership_plans_academic_year_id_idx" ON "public"."membership_plans" USING "btree" ("academic_year_id");



CREATE INDEX "membership_plans_semester_id_idx" ON "public"."membership_plans" USING "btree" ("semester_id");



CREATE INDEX "memberships_plan_id_idx" ON "public"."memberships" USING "btree" ("plan_id");



CREATE INDEX "memberships_user_id_idx" ON "public"."memberships" USING "btree" ("user_id");



CREATE INDEX "notifications_user_id_created_at_idx" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "notifications_user_id_unread_idx" ON "public"."notifications" USING "btree" ("user_id") WHERE ("read_at" IS NULL);



CREATE INDEX "opportunities_website_viewable_idx" ON "public"."opportunities" USING "btree" ("website_viewable", "is_active");



CREATE UNIQUE INDEX "otp_codes_active_idx" ON "public"."otp_codes" USING "btree" ("auth_id", "purpose") WHERE ("used_at" IS NULL);



CREATE INDEX "otp_codes_auth_id_idx" ON "public"."otp_codes" USING "btree" ("auth_id");



CREATE INDEX "payments_membership_id_idx" ON "public"."payments" USING "btree" ("membership_id");



CREATE INDEX "payments_plan_id_idx" ON "public"."payments" USING "btree" ("plan_id");



CREATE UNIQUE INDEX "payments_stripe_checkout_session_id_unique" ON "public"."payments" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE INDEX "payments_stripe_payment_intent_id_idx" ON "public"."payments" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "payments_user_id_idx" ON "public"."payments" USING "btree" ("user_id");



CREATE INDEX "resources_category_idx" ON "public"."resources" USING "btree" ("category");



CREATE INDEX "resources_website_viewable_idx" ON "public"."resources" USING "btree" ("website_viewable", "is_active");



CREATE INDEX "semesters_academic_year_id_idx" ON "public"."semesters" USING "btree" ("academic_year_id");



CREATE INDEX "stripe_events_type_idx" ON "public"."stripe_events" USING "btree" ("type");



CREATE UNIQUE INDEX "users_uh_id_key" ON "public"."users" USING "btree" ("uh_id") WHERE ("uh_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "academic_years_recompute_leaderboard_trg" AFTER INSERT OR UPDATE OF "is_current" ON "public"."academic_years" FOR EACH ROW WHEN (("new"."is_current" = true)) EXECUTE FUNCTION "public"."recompute_leaderboard_on_year_change"();



CREATE OR REPLACE TRIGGER "academic_years_reset_team_rosters_trg" AFTER INSERT OR UPDATE OF "is_current" ON "public"."academic_years" FOR EACH ROW WHEN (("new"."is_current" = true)) EXECUTE FUNCTION "public"."reset_team_rosters_on_year_change"();



CREATE OR REPLACE TRIGGER "academic_years_set_updated_at_trg" BEFORE UPDATE ON "public"."academic_years" FOR EACH ROW EXECUTE FUNCTION "public"."academic_years_set_updated_at"();



CREATE OR REPLACE TRIGGER "finance_accounts_set_updated_at_trg" BEFORE UPDATE ON "public"."finance_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."finance_set_updated_at"();



CREATE OR REPLACE TRIGGER "finance_budgets_set_updated_on_trg" BEFORE UPDATE ON "public"."finance_budgets" FOR EACH ROW EXECUTE FUNCTION "public"."finance_set_updated_on"();



CREATE OR REPLACE TRIGGER "finance_categories_set_updated_at_trg" BEFORE UPDATE ON "public"."finance_categories" FOR EACH ROW EXECUTE FUNCTION "public"."finance_set_updated_at"();



CREATE OR REPLACE TRIGGER "finance_sponsors_set_updated_at_trg" BEFORE UPDATE ON "public"."finance_sponsors" FOR EACH ROW EXECUTE FUNCTION "public"."finance_set_updated_at"();



CREATE OR REPLACE TRIGGER "finance_transactions_set_updated_on_trg" BEFORE UPDATE ON "public"."finance_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."finance_set_updated_on"();



CREATE OR REPLACE TRIGGER "form_questions_set_updated_at_trg" BEFORE UPDATE ON "public"."form_questions" FOR EACH ROW EXECUTE FUNCTION "public"."forms_set_updated_at"();



CREATE OR REPLACE TRIGGER "form_response_answers_set_updated_at_trg" BEFORE UPDATE ON "public"."form_response_answers" FOR EACH ROW EXECUTE FUNCTION "public"."forms_set_updated_at"();



CREATE OR REPLACE TRIGGER "form_responses_set_updated_at_trg" BEFORE UPDATE ON "public"."form_responses" FOR EACH ROW EXECUTE FUNCTION "public"."forms_set_updated_at"();



CREATE OR REPLACE TRIGGER "forms_set_updated_at_trg" BEFORE UPDATE ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."forms_set_updated_at"();



CREATE OR REPLACE TRIGGER "membership_plans_set_updated_at_trg" BEFORE UPDATE ON "public"."membership_plans" FOR EACH ROW EXECUTE FUNCTION "public"."membership_tables_set_updated_at"();



CREATE OR REPLACE TRIGGER "memberships_set_updated_at_trg" BEFORE UPDATE ON "public"."memberships" FOR EACH ROW EXECUTE FUNCTION "public"."membership_tables_set_updated_at"();



CREATE OR REPLACE TRIGGER "on_points_earned" AFTER INSERT OR DELETE OR UPDATE ON "public"."point_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_leaderboard_ranks"();



CREATE OR REPLACE TRIGGER "on_user_roles_updated" BEFORE UPDATE ON "public"."user_positions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "positions_sync_permissions_from_role_trg" AFTER INSERT OR UPDATE OF "role_id" ON "public"."positions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_positions_after_insert_update_role_permissions"();



COMMENT ON TRIGGER "positions_sync_permissions_from_role_trg" ON "public"."positions" IS 'Copies permissions from role_permissions into position_permissions using positions.role_id.';



CREATE OR REPLACE TRIGGER "resources_set_updated_at_trg" BEFORE UPDATE ON "public"."resources" FOR EACH ROW EXECUTE FUNCTION "public"."resources_set_updated_at"();



CREATE OR REPLACE TRIGGER "role_permissions_mirror_to_position_permissions_trg" AFTER INSERT OR DELETE OR UPDATE ON "public"."role_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_role_permissions_mirror_to_positions"();



COMMENT ON TRIGGER "role_permissions_mirror_to_position_permissions_trg" ON "public"."role_permissions" IS 'Adds/removes matching rows in position_permissions for all positions with this role_id.';



CREATE OR REPLACE TRIGGER "semesters_set_updated_at_trg" BEFORE UPDATE ON "public"."semesters" FOR EACH ROW EXECUTE FUNCTION "public"."semesters_set_updated_at"();



CREATE OR REPLACE TRIGGER "teams_members_award_team_participation_points_trg" AFTER INSERT ON "public"."teams_members" FOR EACH ROW EXECUTE FUNCTION "public"."award_team_participation_points_for_member"();



COMMENT ON TRIGGER "teams_members_award_team_participation_points_trg" ON "public"."teams_members" IS 'Grants Team Participation category points when a user joins a team (teams_members insert).';



CREATE OR REPLACE TRIGGER "tickets_set_updated_on_trg" BEFORE UPDATE ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."tickets_set_updated_on"();



CREATE OR REPLACE TRIGGER "tr_create_points_on_attendance" AFTER INSERT ON "public"."events_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."create_point_transaction_on_attendance"();



CREATE OR REPLACE TRIGGER "tr_set_points_on_insert" BEFORE INSERT ON "public"."point_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_transaction_points"();



CREATE OR REPLACE TRIGGER "tr_smart_point_insertion" BEFORE INSERT ON "public"."point_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_transaction_points_and_year"();



CREATE OR REPLACE TRIGGER "tr_sync_points_on_event_category_change" AFTER UPDATE OF "point_category" ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."sync_points_on_event_category_change"();



CREATE OR REPLACE TRIGGER "unassigned_attendance_is_user_to_events_attendance" AFTER UPDATE OF "is_user" ON "public"."unassigned_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."handle_unassigned_attendance_became_user"();



CREATE OR REPLACE TRIGGER "update_deleted_users_updated_at" BEFORE UPDATE ON "public"."deleted_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "user_positions_try_link_auth_id_trg" AFTER INSERT OR UPDATE OF "user_id" ON "public"."user_positions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_user_positions_try_link_auth_id"();



COMMENT ON TRIGGER "user_positions_try_link_auth_id_trg" ON "public"."user_positions" IS 'Attempts to set public.users.auth_id from auth.users by email after assignment changes.';



CREATE OR REPLACE TRIGGER "users_try_link_auth_after_email_ins_trg" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trg_users_try_link_auth_after_email"();



COMMENT ON TRIGGER "users_try_link_auth_after_email_ins_trg" ON "public"."users" IS 'On new public.users rows with NULL auth_id, try linking via auth.users email match.';



CREATE OR REPLACE TRIGGER "users_try_link_auth_after_email_upd_trg" AFTER UPDATE OF "email" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trg_users_try_link_auth_after_email"();



COMMENT ON TRIGGER "users_try_link_auth_after_email_upd_trg" ON "public"."users" IS 'On email change with NULL auth_id, try linking via auth.users email match.';



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "academic_years_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "academic_years_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deleted_users"
    ADD CONSTRAINT "deleted_users_restored_by_user_id_fkey" FOREIGN KEY ("restored_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."deleted_users"
    ADD CONSTRAINT "deleted_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events_attendance"
    ADD CONSTRAINT "events_attendance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."events_attendance"
    ADD CONSTRAINT "events_attendance_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."events_attendance"
    ADD CONSTRAINT "events_attended_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events_attendance"
    ADD CONSTRAINT "events_attended_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events_attending"
    ADD CONSTRAINT "events_attending_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."events_attending"
    ADD CONSTRAINT "events_attending_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_point_category_fkey" FOREIGN KEY ("point_category") REFERENCES "public"."point_categories"("name") ON UPDATE CASCADE ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."finance_budgets"
    ADD CONSTRAINT "finance_budgets_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_budgets"
    ADD CONSTRAINT "finance_budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_budgets"
    ADD CONSTRAINT "finance_budgets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."finance_budgets"
    ADD CONSTRAINT "finance_budgets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_stripe_sync_log"
    ADD CONSTRAINT "finance_stripe_sync_log_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "public"."finance_sponsors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_audience_positions"
    ADD CONSTRAINT "form_audience_positions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_audience_positions"
    ADD CONSTRAINT "form_audience_positions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_audience_roles"
    ADD CONSTRAINT "form_audience_roles_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_audience_roles"
    ADD CONSTRAINT "form_audience_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_question_options"
    ADD CONSTRAINT "form_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."form_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_questions"
    ADD CONSTRAINT "form_questions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_response_answers"
    ADD CONSTRAINT "form_response_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."form_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_response_answers"
    ADD CONSTRAINT "form_response_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."form_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leaderboard"
    ADD CONSTRAINT "leaderboard_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."leaderboard"
    ADD CONSTRAINT "leaderboard_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."leaderboard"
    ADD CONSTRAINT "leaderboard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leaderboards_teams"
    ADD CONSTRAINT "leaderboards_teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."leaderboards_teams"
    ADD CONSTRAINT "leaderboards_teams_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."membership_plans"
    ADD CONSTRAINT "membership_plans_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."membership_plans"
    ADD CONSTRAINT "membership_plans_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_officer_role_fkey" FOREIGN KEY ("officer_role") REFERENCES "public"."user_positions"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_linked_form_id_fkey" FOREIGN KEY ("linked_form_id") REFERENCES "public"."forms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."otp_codes"
    ADD CONSTRAINT "otp_codes_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."point_categories"
    ADD CONSTRAINT "point_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."point_categories"
    ADD CONSTRAINT "point_categories_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."point_categories"("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE RESTRICT ON DELETE SET NULL;



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."position_permissions"
    ADD CONSTRAINT "position_permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."position_permissions"
    ADD CONSTRAINT "position_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."position_permissions"
    ADD CONSTRAINT "position_permissions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."position_permissions"
    ADD CONSTRAINT "position_permissions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON UPDATE CASCADE ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "public_users_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_position_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."positions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."semesters"
    ADD CONSTRAINT "semesters_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."semesters"
    ADD CONSTRAINT "semesters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."semesters"
    ADD CONSTRAINT "semesters_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_academic_year_fkey" FOREIGN KEY ("academic_year") REFERENCES "public"."academic_years"("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."teams_leads"
    ADD CONSTRAINT "teams_leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."teams_leads"
    ADD CONSTRAINT "teams_leads_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."teams_leads"
    ADD CONSTRAINT "teams_leads_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."teams_leads"
    ADD CONSTRAINT "teams_leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."teams_members"
    ADD CONSTRAINT "teams_members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."teams_members"
    ADD CONSTRAINT "teams_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON UPDATE CASCADE ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."teams_members"
    ADD CONSTRAINT "teams_members_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."teams_members"
    ADD CONSTRAINT "teams_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unassigned_attendance"
    ADD CONSTRAINT "unassigned_attendance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."unassigned_attendance"
    ADD CONSTRAINT "unassigned_attendance_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unassigned_attendance"
    ADD CONSTRAINT "unassigned_attendance_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "user_roles_positionTitle_fkey" FOREIGN KEY ("positionTitle") REFERENCES "public"."positions"("title") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "users_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "users_roles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Officers with manage_officer permission can update officer posi" ON "public"."user_positions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ((("public"."user_positions" "up_actor"
     JOIN "public"."positions" "p_actor" ON (("up_actor"."positionTitle" = "p_actor"."title")))
     JOIN "public"."position_permissions" "pp" ON (("p_actor"."id" = "pp"."position_id")))
     JOIN "public"."permissions" "perm" ON (("pp"."permission_id" = "perm"."id")))
  WHERE (("up_actor"."user_id" = ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_id" = "auth"."uid"()))) AND (("p_actor"."is_admin" = true) OR ("perm"."name" = 'manage_officer'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."positions" "p_target"
     JOIN "public"."roles" "r_target" ON (("p_target"."role_id" = "r_target"."id")))
  WHERE (("p_target"."title" = "user_positions"."positionTitle") AND ("r_target"."name" = 'officer'::"text")))));



CREATE POLICY "Superadmin can restore deleted users" ON "public"."deleted_users" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."deleted_at" IS NULL))
 LIMIT 1)));



CREATE POLICY "Superadmin can view deleted users" ON "public"."deleted_users" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."deleted_at" IS NULL))
 LIMIT 1)));



ALTER TABLE "public"."academic_years" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academic_years_delete" ON "public"."academic_years" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_memberships'::"text"));



CREATE POLICY "academic_years_insert" ON "public"."academic_years" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_memberships'::"text"));



CREATE POLICY "academic_years_select_authenticated" ON "public"."academic_years" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "academic_years_update" ON "public"."academic_years" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_memberships'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_memberships'::"text"));



ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deleted_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events_attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events_attending" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_accounts_delete" ON "public"."finance_accounts" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_finance_sources'::"text"));



CREATE POLICY "finance_accounts_insert" ON "public"."finance_accounts" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_finance_sources'::"text"));



CREATE POLICY "finance_accounts_select" ON "public"."finance_accounts" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('view_finances'::"text"));



CREATE POLICY "finance_accounts_update" ON "public"."finance_accounts" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_finance_sources'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_finance_sources'::"text"));



ALTER TABLE "public"."finance_budgets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_budgets_delete" ON "public"."finance_budgets" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_finances'::"text"));



CREATE POLICY "finance_budgets_insert" ON "public"."finance_budgets" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_finances'::"text"));



CREATE POLICY "finance_budgets_select" ON "public"."finance_budgets" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('view_finances'::"text"));



CREATE POLICY "finance_budgets_update" ON "public"."finance_budgets" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_finances'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_finances'::"text"));



ALTER TABLE "public"."finance_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_categories_delete" ON "public"."finance_categories" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_finances'::"text"));



CREATE POLICY "finance_categories_insert" ON "public"."finance_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_finances'::"text"));



CREATE POLICY "finance_categories_select" ON "public"."finance_categories" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('view_finances'::"text"));



CREATE POLICY "finance_categories_update" ON "public"."finance_categories" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_finances'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_finances'::"text"));



ALTER TABLE "public"."finance_sponsors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_sponsors_delete" ON "public"."finance_sponsors" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_finances'::"text"));



CREATE POLICY "finance_sponsors_insert" ON "public"."finance_sponsors" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_finances'::"text"));



CREATE POLICY "finance_sponsors_select" ON "public"."finance_sponsors" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('view_finances'::"text"));



CREATE POLICY "finance_sponsors_update" ON "public"."finance_sponsors" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_finances'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_finances'::"text"));



ALTER TABLE "public"."finance_stripe_sync_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_stripe_sync_log_select" ON "public"."finance_stripe_sync_log" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('manage_finance_sources'::"text"));



ALTER TABLE "public"."finance_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_transactions_delete" ON "public"."finance_transactions" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_finances'::"text"));



CREATE POLICY "finance_transactions_insert" ON "public"."finance_transactions" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_finances'::"text"));



CREATE POLICY "finance_transactions_select" ON "public"."finance_transactions" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('view_finances'::"text"));



CREATE POLICY "finance_transactions_update" ON "public"."finance_transactions" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_finances'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_finances'::"text"));



ALTER TABLE "public"."form_audience_positions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_audience_positions_manage" ON "public"."form_audience_positions" TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_forms'::"text"));



ALTER TABLE "public"."form_audience_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_audience_roles_manage" ON "public"."form_audience_roles" TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_forms'::"text"));



ALTER TABLE "public"."form_question_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_question_options_delete_manage" ON "public"."form_question_options" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text"));



CREATE POLICY "form_question_options_insert_manage" ON "public"."form_question_options" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_forms'::"text"));



CREATE POLICY "form_question_options_select" ON "public"."form_question_options" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."form_questions" "q"
     JOIN "public"."forms" "f" ON (("f"."id" = "q"."form_id")))
  WHERE (("q"."id" = "form_question_options"."question_id") AND ("public"."current_user_has_permission"('manage_forms'::"text") OR (("f"."is_active" IS TRUE) AND ("f"."status" = 'published'::"text") AND "public"."current_user_can_view_form"("f"."id")))))));



CREATE POLICY "form_question_options_update_manage" ON "public"."form_question_options" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_forms'::"text"));



ALTER TABLE "public"."form_questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_questions_delete_manage" ON "public"."form_questions" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text"));



CREATE POLICY "form_questions_insert_manage" ON "public"."form_questions" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_forms'::"text"));



CREATE POLICY "form_questions_select" ON "public"."form_questions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_questions"."form_id") AND ("public"."current_user_has_permission"('manage_forms'::"text") OR (("f"."is_active" IS TRUE) AND ("f"."status" = 'published'::"text") AND "public"."current_user_can_view_form"("f"."id")))))));



CREATE POLICY "form_questions_update_manage" ON "public"."form_questions" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_forms'::"text"));



ALTER TABLE "public"."form_response_answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_response_answers_delete_manage" ON "public"."form_response_answers" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text"));



CREATE POLICY "form_response_answers_delete_own" ON "public"."form_response_answers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."form_responses" "r"
     JOIN "public"."forms" "f" ON (("f"."id" = "r"."form_id")))
  WHERE (("r"."id" = "form_response_answers"."response_id") AND ("r"."respondent_id" = "public"."current_public_user_id"()) AND ("f"."status" = 'published'::"text")))));



CREATE POLICY "form_response_answers_insert_own" ON "public"."form_response_answers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."form_responses" "r"
     JOIN "public"."forms" "f" ON (("f"."id" = "r"."form_id")))
  WHERE (("r"."id" = "form_response_answers"."response_id") AND ("r"."respondent_id" = "public"."current_public_user_id"()) AND ("f"."status" = 'published'::"text")))));



CREATE POLICY "form_response_answers_select_manage" ON "public"."form_response_answers" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text"));



CREATE POLICY "form_response_answers_select_own" ON "public"."form_response_answers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."form_responses" "r"
  WHERE (("r"."id" = "form_response_answers"."response_id") AND ("r"."respondent_id" = "public"."current_public_user_id"())))));



CREATE POLICY "form_response_answers_update_own" ON "public"."form_response_answers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."form_responses" "r"
     JOIN "public"."forms" "f" ON (("f"."id" = "r"."form_id")))
  WHERE (("r"."id" = "form_response_answers"."response_id") AND ("r"."respondent_id" = "public"."current_public_user_id"()) AND ("f"."status" = 'published'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."form_responses" "r"
  WHERE (("r"."id" = "form_response_answers"."response_id") AND ("r"."respondent_id" = "public"."current_public_user_id"())))));



ALTER TABLE "public"."form_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_responses_delete_manage" ON "public"."form_responses" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text"));



CREATE POLICY "form_responses_insert_own" ON "public"."form_responses" FOR INSERT TO "authenticated" WITH CHECK ((("respondent_id" = "public"."current_public_user_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_responses"."form_id") AND ("f"."is_active" IS TRUE) AND ("f"."status" = 'published'::"text") AND "public"."current_user_can_view_form"("f"."id"))))));



CREATE POLICY "form_responses_select_manage" ON "public"."form_responses" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text"));



CREATE POLICY "form_responses_select_own" ON "public"."form_responses" FOR SELECT TO "authenticated" USING (("respondent_id" = "public"."current_public_user_id"()));



CREATE POLICY "form_responses_update_own" ON "public"."form_responses" FOR UPDATE TO "authenticated" USING ((("respondent_id" = "public"."current_public_user_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_responses"."form_id") AND ("f"."status" = 'published'::"text")))))) WITH CHECK (("respondent_id" = "public"."current_public_user_id"()));



ALTER TABLE "public"."forms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forms_delete_manage" ON "public"."forms" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text"));



CREATE POLICY "forms_insert_manage" ON "public"."forms" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_has_permission"('manage_forms'::"text") AND ("created_by" = "public"."current_public_user_id"())));



CREATE POLICY "forms_select_audience" ON "public"."forms" FOR SELECT TO "authenticated" USING ((("is_active" IS TRUE) AND ("status" = 'published'::"text") AND "public"."current_user_can_view_form"("id")));



CREATE POLICY "forms_select_manage" ON "public"."forms" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text"));



CREATE POLICY "forms_update_manage" ON "public"."forms" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_forms'::"text"));



ALTER TABLE "public"."leaderboard" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leaderboards_teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manage_academic_years_delete" ON "public"."academic_years" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_academic_years'::"text"));



CREATE POLICY "manage_academic_years_insert" ON "public"."academic_years" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_academic_years'::"text"));



CREATE POLICY "manage_academic_years_update" ON "public"."academic_years" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_academic_years'::"text")) WITH CHECK ("public"."has_permission"('manage_academic_years'::"text"));



CREATE POLICY "manage_branches_delete" ON "public"."branches" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_branches'::"text"));



CREATE POLICY "manage_branches_insert" ON "public"."branches" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_branches'::"text"));



CREATE POLICY "manage_branches_update" ON "public"."branches" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_branches'::"text")) WITH CHECK ("public"."has_permission"('manage_branches'::"text"));



CREATE POLICY "manage_events_attendance_delete" ON "public"."events_attendance" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_events_attendance'::"text"));



CREATE POLICY "manage_events_attendance_insert" ON "public"."events_attendance" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_events_attendance'::"text"));



CREATE POLICY "manage_events_attendance_update" ON "public"."events_attendance" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_events_attendance'::"text")) WITH CHECK ("public"."has_permission"('manage_events_attendance'::"text"));



CREATE POLICY "manage_events_attending_delete" ON "public"."events_attending" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_events_attending'::"text"));



CREATE POLICY "manage_events_attending_insert" ON "public"."events_attending" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_events_attending'::"text"));



CREATE POLICY "manage_events_attending_update" ON "public"."events_attending" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_events_attending'::"text")) WITH CHECK ("public"."has_permission"('manage_events_attending'::"text"));



CREATE POLICY "manage_events_delete" ON "public"."events" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_events'::"text"));



CREATE POLICY "manage_events_insert" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_events'::"text"));



CREATE POLICY "manage_events_update" ON "public"."events" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_events'::"text")) WITH CHECK ("public"."has_permission"('manage_events'::"text"));



CREATE POLICY "manage_leaderboard_delete" ON "public"."leaderboard" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_leaderboard'::"text"));



CREATE POLICY "manage_leaderboard_insert" ON "public"."leaderboard" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_leaderboard'::"text"));



CREATE POLICY "manage_leaderboard_update" ON "public"."leaderboard" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_leaderboard'::"text")) WITH CHECK ("public"."has_permission"('manage_leaderboard'::"text"));



CREATE POLICY "manage_leaderboards_teams_delete" ON "public"."leaderboards_teams" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_leaderboards_teams'::"text"));



CREATE POLICY "manage_leaderboards_teams_insert" ON "public"."leaderboards_teams" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_leaderboards_teams'::"text"));



CREATE POLICY "manage_leaderboards_teams_update" ON "public"."leaderboards_teams" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_leaderboards_teams'::"text")) WITH CHECK ("public"."has_permission"('manage_leaderboards_teams'::"text"));



CREATE POLICY "manage_officer_profiles_delete" ON "public"."officer_profiles" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_officer_profiles'::"text"));



CREATE POLICY "manage_officer_profiles_insert" ON "public"."officer_profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_officer_profiles'::"text"));



CREATE POLICY "manage_officer_profiles_update" ON "public"."officer_profiles" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_officer_profiles'::"text")) WITH CHECK ("public"."has_permission"('manage_officer_profiles'::"text"));



CREATE POLICY "manage_opportunities_delete" ON "public"."opportunities" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_opportunities'::"text"));



CREATE POLICY "manage_opportunities_insert" ON "public"."opportunities" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_opportunities'::"text"));



CREATE POLICY "manage_opportunities_update" ON "public"."opportunities" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_opportunities'::"text")) WITH CHECK ("public"."has_permission"('manage_opportunities'::"text"));



CREATE POLICY "manage_payments_delete" ON "public"."payments" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_payments'::"text"));



CREATE POLICY "manage_payments_insert" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_payments'::"text"));



CREATE POLICY "manage_payments_update" ON "public"."payments" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_payments'::"text")) WITH CHECK ("public"."has_permission"('manage_payments'::"text"));



CREATE POLICY "manage_permissions_delete" ON "public"."permissions" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_permissions'::"text"));



CREATE POLICY "manage_permissions_insert" ON "public"."permissions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_permissions'::"text"));



CREATE POLICY "manage_permissions_update" ON "public"."permissions" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_permissions'::"text")) WITH CHECK ("public"."has_permission"('manage_permissions'::"text"));



CREATE POLICY "manage_point_categories_delete" ON "public"."point_categories" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_point_categories'::"text"));



CREATE POLICY "manage_point_categories_insert" ON "public"."point_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_point_categories'::"text"));



CREATE POLICY "manage_point_categories_update" ON "public"."point_categories" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_point_categories'::"text")) WITH CHECK ("public"."has_permission"('manage_point_categories'::"text"));



CREATE POLICY "manage_point_transactions_delete" ON "public"."point_transactions" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_point_transactions'::"text"));



CREATE POLICY "manage_point_transactions_insert" ON "public"."point_transactions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_point_transactions'::"text"));



CREATE POLICY "manage_point_transactions_update" ON "public"."point_transactions" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_point_transactions'::"text")) WITH CHECK ("public"."has_permission"('manage_point_transactions'::"text"));



CREATE POLICY "manage_points_delete" ON "public"."points" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_points'::"text"));



CREATE POLICY "manage_points_insert" ON "public"."points" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_points'::"text"));



CREATE POLICY "manage_points_update" ON "public"."points" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_points'::"text")) WITH CHECK ("public"."has_permission"('manage_points'::"text"));



CREATE POLICY "manage_position_permissions_delete" ON "public"."position_permissions" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_position_permissions'::"text"));



CREATE POLICY "manage_position_permissions_insert" ON "public"."position_permissions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_position_permissions'::"text"));



CREATE POLICY "manage_position_permissions_update" ON "public"."position_permissions" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_position_permissions'::"text")) WITH CHECK ("public"."has_permission"('manage_position_permissions'::"text"));



CREATE POLICY "manage_positions_delete" ON "public"."positions" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_positions'::"text"));



CREATE POLICY "manage_positions_insert" ON "public"."positions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_positions'::"text"));



CREATE POLICY "manage_positions_update" ON "public"."positions" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_positions'::"text")) WITH CHECK ("public"."has_permission"('manage_positions'::"text"));



CREATE POLICY "manage_projects_delete" ON "public"."projects" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_projects'::"text"));



CREATE POLICY "manage_projects_insert" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_projects'::"text"));



CREATE POLICY "manage_projects_update" ON "public"."projects" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_projects'::"text")) WITH CHECK ("public"."has_permission"('manage_projects'::"text"));



CREATE POLICY "manage_role_permissions_delete" ON "public"."role_permissions" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_role_permissions'::"text"));



CREATE POLICY "manage_role_permissions_insert" ON "public"."role_permissions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_role_permissions'::"text"));



CREATE POLICY "manage_role_permissions_update" ON "public"."role_permissions" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_role_permissions'::"text")) WITH CHECK ("public"."has_permission"('manage_role_permissions'::"text"));



CREATE POLICY "manage_roles_delete" ON "public"."roles" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_roles'::"text"));



CREATE POLICY "manage_roles_insert" ON "public"."roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_roles'::"text"));



CREATE POLICY "manage_roles_update" ON "public"."roles" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_roles'::"text")) WITH CHECK ("public"."has_permission"('manage_roles'::"text"));



CREATE POLICY "manage_tasks_delete" ON "public"."tasks" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_tasks'::"text"));



CREATE POLICY "manage_tasks_insert" ON "public"."tasks" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_tasks'::"text"));



CREATE POLICY "manage_tasks_update" ON "public"."tasks" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_tasks'::"text")) WITH CHECK ("public"."has_permission"('manage_tasks'::"text"));



CREATE POLICY "manage_teams_delete" ON "public"."teams" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_teams'::"text"));



CREATE POLICY "manage_teams_insert" ON "public"."teams" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_teams'::"text"));



CREATE POLICY "manage_teams_leads_delete" ON "public"."teams_leads" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_teams_leads'::"text"));



CREATE POLICY "manage_teams_leads_insert" ON "public"."teams_leads" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_teams_leads'::"text"));



CREATE POLICY "manage_teams_leads_update" ON "public"."teams_leads" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_teams_leads'::"text")) WITH CHECK ("public"."has_permission"('manage_teams_leads'::"text"));



CREATE POLICY "manage_teams_members_delete" ON "public"."teams_members" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_teams_members'::"text"));



CREATE POLICY "manage_teams_members_insert" ON "public"."teams_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_teams_members'::"text"));



CREATE POLICY "manage_teams_members_update" ON "public"."teams_members" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_teams_members'::"text")) WITH CHECK ("public"."has_permission"('manage_teams_members'::"text"));



CREATE POLICY "manage_teams_update" ON "public"."teams" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_teams'::"text")) WITH CHECK ("public"."has_permission"('manage_teams'::"text"));



CREATE POLICY "manage_unassigned_members can delete" ON "public"."unassigned_attendance" FOR DELETE USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'manage_unassigned_members'::"text"));



CREATE POLICY "manage_unassigned_members can insert" ON "public"."unassigned_attendance" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'user_role'::"text") = 'manage_unassigned_members'::"text"));



CREATE POLICY "manage_unassigned_members can select" ON "public"."unassigned_attendance" FOR SELECT USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'manage_unassigned_members'::"text"));



CREATE POLICY "manage_unassigned_members can update" ON "public"."unassigned_attendance" FOR UPDATE USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'manage_unassigned_members'::"text"));



CREATE POLICY "manage_user_positions_delete" ON "public"."user_positions" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_user_positions'::"text"));



CREATE POLICY "manage_user_positions_insert" ON "public"."user_positions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_user_positions'::"text"));



CREATE POLICY "manage_user_positions_update" ON "public"."user_positions" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_user_positions'::"text")) WITH CHECK ("public"."has_permission"('manage_user_positions'::"text"));



CREATE POLICY "manage_users_delete" ON "public"."users" FOR DELETE TO "authenticated" USING ("public"."has_permission"('manage_users'::"text"));



CREATE POLICY "manage_users_insert" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('manage_users'::"text"));



CREATE POLICY "manage_users_update" ON "public"."users" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('manage_users'::"text")) WITH CHECK ("public"."has_permission"('manage_users'::"text"));



ALTER TABLE "public"."membership_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membership_plans_insert" ON "public"."membership_plans" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_memberships'::"text"));



CREATE POLICY "membership_plans_select" ON "public"."membership_plans" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "membership_plans_update" ON "public"."membership_plans" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_memberships'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_memberships'::"text"));



ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "memberships_select_manage" ON "public"."memberships" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('manage_memberships'::"text"));



CREATE POLICY "memberships_select_own" ON "public"."memberships" FOR SELECT TO "authenticated" USING (("user_id" = "public"."current_public_user_id"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "public"."current_public_user_id"()));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "public"."current_public_user_id"())) WITH CHECK (("user_id" = "public"."current_public_user_id"()));



ALTER TABLE "public"."officer_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opportunities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "opportunities_delete_manage" ON "public"."opportunities" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_opportunities'::"text"));



CREATE POLICY "opportunities_insert_manage" ON "public"."opportunities" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_opportunities'::"text"));



CREATE POLICY "opportunities_select_active" ON "public"."opportunities" FOR SELECT TO "authenticated" USING ((("is_active" IS TRUE) AND (("expires_at" IS NULL) OR ("expires_at" > "now"()))));



COMMENT ON POLICY "opportunities_select_active" ON "public"."opportunities" IS 'Any authenticated member can browse active, unexpired postings.';



CREATE POLICY "opportunities_select_manage" ON "public"."opportunities" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('manage_opportunities'::"text"));



COMMENT ON POLICY "opportunities_select_manage" ON "public"."opportunities" IS 'manage_opportunities holders (officers/execs/admins) can see all postings, including inactive ones pending review after a CSV import.';



CREATE POLICY "opportunities_update_manage" ON "public"."opportunities" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_opportunities'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_opportunities'::"text"));



ALTER TABLE "public"."otp_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_insert_own_pending" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "public"."current_public_user_id"()) AND ("status" = 'pending'::"text")));



CREATE POLICY "payments_select_manage" ON "public"."payments" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('manage_memberships'::"text"));



CREATE POLICY "payments_select_own" ON "public"."payments" FOR SELECT TO "authenticated" USING (("user_id" = "public"."current_public_user_id"()));



ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."point_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "point_categories_delete_manage" ON "public"."point_categories" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_point_categories'::"text"));



CREATE POLICY "point_categories_insert_manage" ON "public"."point_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_point_categories'::"text"));



CREATE POLICY "point_categories_select_authenticated" ON "public"."point_categories" FOR SELECT TO "authenticated" USING ("public"."current_user_can_select_point_categories"());



CREATE POLICY "point_categories_update_manage" ON "public"."point_categories" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_point_categories'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_point_categories'::"text"));



ALTER TABLE "public"."point_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."position_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resources_delete_manage" ON "public"."resources" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_resources'::"text"));



CREATE POLICY "resources_insert_manage" ON "public"."resources" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_resources'::"text"));



CREATE POLICY "resources_select_active" ON "public"."resources" FOR SELECT TO "authenticated" USING (("is_active" IS TRUE));



COMMENT ON POLICY "resources_select_active" ON "public"."resources" IS 'Any authenticated member can browse active resources. website_viewable is not checked here: it gates the public site, not the member-facing app.';



CREATE POLICY "resources_select_manage" ON "public"."resources" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('manage_resources'::"text"));



COMMENT ON POLICY "resources_select_manage" ON "public"."resources" IS 'manage_resources holders (officers/execs/admins) can see all resources, including deactivated ones.';



CREATE POLICY "resources_update_manage" ON "public"."resources" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_resources'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_resources'::"text"));



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."semesters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "semesters_delete" ON "public"."semesters" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_memberships'::"text"));



CREATE POLICY "semesters_insert" ON "public"."semesters" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_memberships'::"text"));



CREATE POLICY "semesters_select_authenticated" ON "public"."semesters" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "semesters_update" ON "public"."semesters" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_memberships'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_memberships'::"text"));



ALTER TABLE "public"."stripe_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_leads_select_authenticated" ON "public"."teams_leads" FOR SELECT TO "authenticated" USING (true);



COMMENT ON POLICY "teams_leads_select_authenticated" ON "public"."teams_leads" IS 'Authenticated users can view team lead assignments.';



ALTER TABLE "public"."teams_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_members_select_authenticated" ON "public"."teams_members" FOR SELECT TO "authenticated" USING (true);



COMMENT ON POLICY "teams_members_select_authenticated" ON "public"."teams_members" IS 'Authenticated users can view team membership rosters.';



CREATE POLICY "teams_select_authenticated" ON "public"."teams" FOR SELECT TO "authenticated" USING (true);



COMMENT ON POLICY "teams_select_authenticated" ON "public"."teams" IS 'Authenticated users can view all team records.';



CREATE POLICY "teams_update_lead_or_manage_teams" ON "public"."teams" FOR UPDATE TO "authenticated" USING (("public"."current_user_has_permission"('manage_teams'::"text") OR (EXISTS ( SELECT 1
   FROM ("public"."teams_leads" "tl"
     JOIN "public"."users" "u" ON (("u"."id" = "tl"."user_id")))
  WHERE (("tl"."team_id" = "teams"."id") AND ("u"."auth_id" = "auth"."uid"())))))) WITH CHECK (("public"."current_user_has_permission"('manage_teams'::"text") OR (EXISTS ( SELECT 1
   FROM ("public"."teams_leads" "tl"
     JOIN "public"."users" "u" ON (("u"."id" = "tl"."user_id")))
  WHERE (("tl"."team_id" = "teams"."id") AND ("u"."auth_id" = "auth"."uid"()))))));



COMMENT ON POLICY "teams_update_lead_or_manage_teams" ON "public"."teams" IS 'Team leads may update their own team; manage_teams can update any team.';



ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tickets_delete_manage" ON "public"."tickets" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_tickets'::"text"));



CREATE POLICY "tickets_insert_own" ON "public"."tickets" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "u"."id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "tickets_select_manage" ON "public"."tickets" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('manage_tickets'::"text"));



CREATE POLICY "tickets_select_own" ON "public"."tickets" FOR SELECT TO "authenticated" USING (("created_by" = ( SELECT "u"."id"
   FROM "public"."users" "u"
  WHERE ("u"."auth_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "tickets_select_view" ON "public"."tickets" FOR SELECT TO "authenticated" USING ((("is_active" IS TRUE) AND "public"."current_user_has_permission"('view_tickets'::"text")));



CREATE POLICY "tickets_update_manage" ON "public"."tickets" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_tickets'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_tickets'::"text"));



ALTER TABLE "public"."unassigned_attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unassigned_attendance_select_events_viewers" ON "public"."unassigned_attendance" FOR SELECT TO "authenticated" USING (("public"."current_user_has_permission"('view_events'::"text") OR "public"."current_user_has_permission"('manage_events'::"text")));



COMMENT ON POLICY "unassigned_attendance_select_events_viewers" ON "public"."unassigned_attendance" IS 'Event viewers/managers may read unassigned attendance rows for reporting and CSV workflows.';



ALTER TABLE "public"."user_positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "view_academic_years_policy" ON "public"."academic_years" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_academic_years'::"text"));



CREATE POLICY "view_branches_policy" ON "public"."branches" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_branches'::"text"));



CREATE POLICY "view_events_attendance_policy" ON "public"."events_attendance" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_events_attendance'::"text"));



CREATE POLICY "view_events_attending_policy" ON "public"."events_attending" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_events_attending'::"text"));



CREATE POLICY "view_events_policy" ON "public"."events" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_events'::"text"));



CREATE POLICY "view_leaderboard_policy" ON "public"."leaderboard" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_leaderboard'::"text"));



CREATE POLICY "view_leaderboards_teams_policy" ON "public"."leaderboards_teams" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_leaderboards_teams'::"text"));



CREATE POLICY "view_officer_profiles_policy" ON "public"."officer_profiles" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_officer_profiles'::"text"));



CREATE POLICY "view_opportunities_policy" ON "public"."opportunities" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_opportunities'::"text"));



CREATE POLICY "view_payments_policy" ON "public"."payments" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_payments'::"text"));



CREATE POLICY "view_permissions_policy" ON "public"."permissions" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_permissions'::"text"));



CREATE POLICY "view_point_categories_policy" ON "public"."point_categories" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_point_categories'::"text"));



CREATE POLICY "view_point_transactions_policy" ON "public"."point_transactions" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_point_transactions'::"text"));



CREATE POLICY "view_points_policy" ON "public"."points" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_points'::"text"));



CREATE POLICY "view_position_permissions_policy" ON "public"."position_permissions" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_position_permissions'::"text"));



CREATE POLICY "view_positions_policy" ON "public"."positions" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_positions'::"text"));



CREATE POLICY "view_projects_policy" ON "public"."projects" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_projects'::"text"));



CREATE POLICY "view_role_permissions_policy" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_role_permissions'::"text"));



CREATE POLICY "view_roles_policy" ON "public"."roles" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_roles'::"text"));



CREATE POLICY "view_tasks_policy" ON "public"."tasks" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_tasks'::"text"));



CREATE POLICY "view_teams_leads_policy" ON "public"."teams_leads" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_teams_leads'::"text"));



CREATE POLICY "view_teams_members_policy" ON "public"."teams_members" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_teams_members'::"text"));



CREATE POLICY "view_teams_policy" ON "public"."teams" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_teams'::"text"));



CREATE POLICY "view_unassigned_members can select" ON "public"."unassigned_attendance" FOR SELECT USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'view_unassigned_members'::"text"));



CREATE POLICY "view_user_positions_policy" ON "public"."user_positions" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_user_positions'::"text"));



CREATE POLICY "view_users_policy" ON "public"."users" FOR SELECT TO "authenticated" USING ("public"."has_permission"('view_users'::"text"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."academic_years_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."academic_years_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."academic_years_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."app_permission_matches"("stored" "text", "required" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."app_permission_matches"("stored" "text", "required" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_permission_matches"("stored" "text", "required" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."award_team_participation_points_for_member"() TO "anon";
GRANT ALL ON FUNCTION "public"."award_team_participation_points_for_member"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_team_participation_points_for_member"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_point_transaction_on_attendance"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_point_transaction_on_attendance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_point_transaction_on_attendance"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_public_user_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_public_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_public_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_public_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_can_select_point_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_can_select_point_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_can_select_point_categories"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_user_can_view_form"("p_form_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_can_view_form"("p_form_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_can_view_form"("p_form_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_can_view_form"("p_form_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_has_permission"("required_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_has_permission"("required_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_has_permission"("required_permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."finance_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."finance_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."finance_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."finance_set_updated_on"() TO "anon";
GRANT ALL ON FUNCTION "public"."finance_set_updated_on"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."finance_set_updated_on"() TO "service_role";



GRANT ALL ON FUNCTION "public"."forms_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."forms_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."forms_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_auth_activity_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_auth_activity_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_auth_activity_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_link"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_unassigned_attendance_became_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_unassigned_attendance_became_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_unassigned_attendance_became_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_unassigned_attendance_became_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("perm_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("perm_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("perm_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_event_attendance_from_json"("p_event_id" bigint, "p_attendees" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_event_attendance_from_json"("p_event_id" bigint, "p_attendees" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."import_event_attendance_from_json"("p_event_id" bigint, "p_attendees" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_event_attendance_from_json"("p_event_id" bigint, "p_attendees" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_forms_for_opportunity_linking"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_forms_for_opportunity_linking"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_forms_for_opportunity_linking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_forms_for_opportunity_linking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."membership_tables_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."membership_tables_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."membership_tables_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_form_published"("p_form_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_form_published"("p_form_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_form_published"("p_form_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_form_published"("p_form_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_new_opportunity"("p_opportunity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_new_opportunity"("p_opportunity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_opportunity"("p_opportunity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_opportunity"("p_opportunity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_payments_from_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_payments_from_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_payments_from_users"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_stripe_event"("p_event_id" "text", "p_type" "text", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_stripe_event"("p_event_id" "text", "p_type" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."process_stripe_event"("p_event_id" "text", "p_type" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_stripe_event"("p_event_id" "text", "p_type" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_leaderboard_on_year_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_leaderboard_on_year_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_leaderboard_on_year_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_position_permissions_from_role"("p_position_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_position_permissions_from_role"("p_position_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_position_permissions_from_role"("p_position_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_position_permissions_from_role"("p_position_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_team_rosters_on_year_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_team_rosters_on_year_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_team_rosters_on_year_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resources_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."resources_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."resources_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."semesters_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."semesters_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."semesters_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_transaction_points"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_transaction_points"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_transaction_points"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_transaction_points_and_year"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_transaction_points_and_year"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_transaction_points_and_year"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_user_avatar"("p_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_avatar"("p_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_avatar"("p_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_avatar"("p_url" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_my_signup_profile_from_auth"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_my_signup_profile_from_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_my_signup_profile_from_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_my_signup_profile_from_auth"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_oauth_profile_to_public_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_oauth_profile_to_public_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_oauth_profile_to_public_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_oauth_profile_to_public_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_points_on_event_category_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_points_on_event_category_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_points_on_event_category_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tickets_set_updated_on"() TO "anon";
GRANT ALL ON FUNCTION "public"."tickets_set_updated_on"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tickets_set_updated_on"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_positions_after_insert_update_role_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_positions_after_insert_update_role_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_positions_after_insert_update_role_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_role_permissions_mirror_to_positions"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_role_permissions_mirror_to_positions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_role_permissions_mirror_to_positions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_user_positions_try_link_auth_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_user_positions_try_link_auth_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_user_positions_try_link_auth_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_users_try_link_auth_after_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_users_try_link_auth_after_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_users_try_link_auth_after_email"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."try_link_public_user_auth_id"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."try_link_public_user_auth_id"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."try_link_public_user_auth_id"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."try_link_public_user_auth_id"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_leaderboard_ranks"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_leaderboard_ranks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_leaderboard_ranks"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_my_profile"("p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_classification" "text", "p_expected_graduation" "text", "p_major" "text", "p_uh_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_classification" "text", "p_expected_graduation" "text", "p_major" "text", "p_uh_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_classification" "text", "p_expected_graduation" "text", "p_major" "text", "p_uh_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_classification" "text", "p_expected_graduation" "text", "p_major" "text", "p_uh_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."academic_years" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."academic_years" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."academic_years" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."opportunities" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."opportunities" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."opportunities" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."active_opportunities" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."active_opportunities" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."active_opportunities" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."branches" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."branches" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."branches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."branches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."branches_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."deleted_users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."deleted_users" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."deleted_users" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attendance" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attendance" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attendance" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attending" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attending" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attending" TO "service_role";



GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_accounts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_accounts" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_accounts" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_budgets" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_budgets" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_budgets" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_categories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_categories" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_categories" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_sponsors" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_sponsors" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_sponsors" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_stripe_sync_log" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_stripe_sync_log" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_stripe_sync_log" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_transactions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_transactions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_transactions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_audience_positions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_audience_positions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_audience_positions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_audience_roles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_audience_roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_audience_roles" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_question_options" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_question_options" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_question_options" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_questions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_questions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_questions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_response_answers" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_response_answers" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_response_answers" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_responses" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_responses" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_responses" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."forms" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."forms" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."forms" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboard" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboard" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboard" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboards_teams" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboards_teams" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboards_teams" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."membership_plans" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."membership_plans" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."membership_plans" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."memberships" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."memberships" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."memberships" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."notifications" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."notifications" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."notifications" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."officer_profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."officer_profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."officer_profiles" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."otp_codes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."otp_codes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."otp_codes" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."payments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."payments" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."payments" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."permissions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_categories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_categories" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_categories" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_transactions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_transactions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_transactions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."points" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."points" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."points" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_permissions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."positions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."positions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."positions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."positions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."positions_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."projects" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."projects" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON SEQUENCE "public"."projects_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."projects_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."projects_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."resources" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."resources" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."resources" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."role_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."role_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."role_permissions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."semesters" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."semesters" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."semesters" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stripe_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stripe_events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stripe_events" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tasks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tasks" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tasks" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_leads" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_leads" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_leads" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_members" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_members" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_members" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tickets" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tickets" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tickets" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."unassigned_attendance" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."unassigned_attendance" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."unassigned_attendance" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_positions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_positions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_positions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profile" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profile" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profile" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";








-- ---------------------------------------------------------------------------
-- 2. system sentinel user  (data, but the schema does not work without it)
-- ---------------------------------------------------------------------------
-- 40 columns across 20 tables (created_by x20, updated_by x20) DEFAULT to this
-- uuid and carry an FK to public.users(id). Without this row a fresh database
-- rejects almost every insert -- including ones the app makes, not just seeds.
-- So it lives here rather than in seed.sql, which a branch may run with
-- seeding disabled. Values mirror production.

INSERT INTO "public"."users" ("id", "first_name", "last_name", "email", "classification")
VALUES ('00000000-0000-0000-0000-000000000001', 'Code', 'Coogs', 'main@codecoogs.com', 'Senior')
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. auth triggers  (NOT in a --schema public dump)
-- ---------------------------------------------------------------------------
-- The dump ships public.handle_new_user_link() but not the trigger that fires
-- it. Without this, signup silently never creates a public.users row.

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_link();

-- ---------------------------------------------------------------------------
-- 4. storage buckets  (NOT in a --schema public dump)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('assets', 'assets', true, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', true, 5242880, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('form-uploads', 'form-uploads', false, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('logos', 'logos', false, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('Officer Pictures', 'Officer Pictures', false, null, '{image/png,image/jpeg,image/gif,image/jpg,image/raw,image/tif,image/webp}'::text[]) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. storage.objects RLS policies  (NOT in a --schema public dump)
-- ---------------------------------------------------------------------------
-- The dump sets search_path = '' at the top. These policies reference
-- form_responses / current_public_user_id() unqualified, so they need public
-- on the search_path at CREATE time (Postgres resolves and stores the OIDs
-- then, so this only matters here).

SET search_path = public;

create policy assets_flyers_insert_authenticated on storage.objects for INSERT to authenticated with check (((bucket_id = 'assets'::text) AND (name ~~ 'flyers/%'::text)));
create policy assets_flyers_update_authenticated on storage.objects for UPDATE to authenticated using (((bucket_id = 'assets'::text) AND (name ~~ 'flyers/%'::text))) with check (((bucket_id = 'assets'::text) AND (name ~~ 'flyers/%'::text)));
create policy assets_public_read on storage.objects for SELECT to public using ((bucket_id = 'assets'::text));
create policy assets_team_images_delete_authenticated on storage.objects for DELETE to authenticated using (((bucket_id = 'assets'::text) AND (name ~~ 'team-images/%'::text)));
create policy assets_team_images_insert_authenticated on storage.objects for INSERT to authenticated with check (((bucket_id = 'assets'::text) AND (name ~~ 'team-images/%'::text)));
create policy assets_team_images_update_authenticated on storage.objects for UPDATE to authenticated using (((bucket_id = 'assets'::text) AND (name ~~ 'team-images/%'::text))) with check (((bucket_id = 'assets'::text) AND (name ~~ 'team-images/%'::text)));
create policy avatars_delete_own_folder on storage.objects for DELETE to authenticated using (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = ( SELECT (auth.uid())::text AS uid))));
create policy avatars_insert_own_folder on storage.objects for INSERT to authenticated with check (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = ( SELECT (auth.uid())::text AS uid))));
create policy avatars_public_read on storage.objects for SELECT to public using ((bucket_id = 'avatars'::text));
create policy avatars_update_own_folder on storage.objects for UPDATE to authenticated using (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = ( SELECT (auth.uid())::text AS uid)))) with check (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = ( SELECT (auth.uid())::text AS uid))));
create policy "form_uploads_insert_own_response 1gyfceh_0" on storage.objects for INSERT to public with check (((bucket_id = 'form-uploads'::text) AND (EXISTS ( SELECT 1
   FROM form_responses r
  WHERE (((r.id)::text = split_part(objects.name, '/'::text, 1)) AND (r.respondent_id = current_public_user_id()))))));
create policy "form_uploads_select_own_response 1gyfceh_0" on storage.objects for SELECT to public using (((bucket_id = 'form-uploads'::text) AND ((EXISTS ( SELECT 1
   FROM form_responses r
  WHERE (((r.id)::text = split_part(objects.name, '/'::text, 1)) AND (r.respondent_id = current_public_user_id())))) OR current_user_has_permission('manage_forms'::text))));
create policy "form_uploads_update_own_response 1gyfceh_0" on storage.objects for UPDATE to public using (((bucket_id = 'form-uploads'::text) AND (EXISTS ( SELECT 1
   FROM form_responses r
  WHERE (((r.id)::text = split_part(objects.name, '/'::text, 1)) AND (r.respondent_id = current_public_user_id()))))));
create policy "form_uploads_update_own_response 1gyfceh_1" on storage.objects for SELECT to public using (((bucket_id = 'form-uploads'::text) AND (EXISTS ( SELECT 1
   FROM form_responses r
  WHERE (((r.id)::text = split_part(objects.name, '/'::text, 1)) AND (r.respondent_id = current_public_user_id()))))));
