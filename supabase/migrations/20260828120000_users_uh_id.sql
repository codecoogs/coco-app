-- UH ID: 7-digit university student ID, required for CSI (Center of Student
-- Involvement) org rostering compliance. Nullable for existing rows (they're
-- prompted to fill it in via a dashboard banner); collected as required at
-- signup going forward.

alter table public.users
  add column if not exists uh_id text;

alter table public.users
  add constraint users_uh_id_format check (uh_id is null or uh_id ~ '^[0-9]{7}$');

-- Allows any number of NULLs (existing rows) while still preventing two
-- accounts from claiming the same UH ID once set.
create unique index if not exists users_uh_id_key
  on public.users (uh_id)
  where uh_id is not null;

-- Extend the signup trigger to also sync uh_id from auth metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.handle_new_user_link() IS
  'After auth.users insert: link or create public.users; apply signup metadata (first_name, last_name, major, expected_graduation, uh_id).';

-- Extend the invite/finish-signup sync RPC the same way.
CREATE OR REPLACE FUNCTION public.sync_my_signup_profile_from_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.sync_my_signup_profile_from_auth() IS
  'Upserts public.users from auth.raw_user_meta_data (first_name, last_name, major, expected_graduation, uh_id) for the current user.';

-- Extend the settings-page profile update RPC to also accept uh_id.
-- New parameter list = a different overload to Postgres, so the old 6-arg
-- signature must be dropped explicitly or it'd linger unused.
DROP FUNCTION IF EXISTS public.update_my_profile(text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_classification text,
  p_expected_graduation text,
  p_major text,
  p_uh_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

ALTER FUNCTION public.update_my_profile(text, text, text, text, text, text, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.update_my_profile(text, text, text, text, text, text, text) IS
  'Updates public.users fields for the current auth user (auth_id = auth.uid()), including uh_id.';
