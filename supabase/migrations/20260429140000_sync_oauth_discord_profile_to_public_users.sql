-- After Discord (or other OAuth) callback: ensure public.users has a row and fill
-- display name + avatar_url from auth.identities / raw_user_meta_data when missing.
-- Complements handle_new_user_link (INSERT-only) and linkIdentity (no trigger).

CREATE OR REPLACE FUNCTION public.sync_oauth_profile_to_public_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

ALTER FUNCTION public.sync_oauth_profile_to_public_user() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.sync_oauth_profile_to_public_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_oauth_profile_to_public_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_oauth_profile_to_public_user() TO service_role;

COMMENT ON FUNCTION public.sync_oauth_profile_to_public_user() IS
  'Upserts public.users for the current auth user using Discord identity_data and OAuth user_metadata (name, avatar_url, discord handle). Fills empty fields only on UPDATE.';
