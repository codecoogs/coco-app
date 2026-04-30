-- Ensure public.users reflects signup metadata from auth (raw_user_meta_data).
-- Covers invite "finish account" (auth UPDATE only — no INSERT trigger) and edge cases
-- where the new-user trigger did not create or link a row yet.

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

  UPDATE public.users
  SET
    auth_id = auth.uid(),
    first_name = COALESCE(meta_first, first_name),
    last_name = COALESCE(meta_last, last_name),
    major = COALESCE(meta_major, major),
    expected_graduation = COALESCE(meta_grad, expected_graduation),
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
      expected_graduation
    )
    VALUES (
      auth.uid(),
      COALESCE(nullif(trim(v_email), ''), ''),
      COALESCE(meta_first, ''),
      COALESCE(meta_last, ''),
      COALESCE(meta_major, ''),
      COALESCE(meta_grad, '')
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
      updated = now();
  END IF;
END;
$$;

ALTER FUNCTION public.sync_my_signup_profile_from_auth() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.sync_my_signup_profile_from_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_my_signup_profile_from_auth() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_my_signup_profile_from_auth() TO service_role;

COMMENT ON FUNCTION public.sync_my_signup_profile_from_auth() IS
  'Upserts public.users from auth.raw_user_meta_data (first_name, last_name, major, expected_graduation) for the current user.';
