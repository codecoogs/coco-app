-- Allow members to update their own profile fields (public.users) without granting
-- broad UPDATE access on the table. Uses SECURITY DEFINER with auth.uid() scoping.

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_classification text,
  p_expected_graduation text,
  p_major text
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
    updated = now()
  WHERE auth_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'No profile row for this user';
  END IF;
END;
$$;

ALTER FUNCTION public.update_my_profile(text, text, text, text, text, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.update_my_profile(text, text, text, text, text, text) IS
  'Updates public.users fields for the current auth user (auth_id = auth.uid()).';

