-- Profile pictures: public URL on public.users, files in storage bucket `avatars/`.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.users.avatar_url IS
  'Public URL for the member profile image (Supabase Storage bucket avatars, path = auth user id / filename).';

-- Public bucket: profile images are referenced by URL across the app (leaderboard, etc.).
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Upload only into folder named with the current auth user id (first path segment).
DROP POLICY IF EXISTS "avatars_insert_own_folder" ON storage.objects;
CREATE POLICY "avatars_insert_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "avatars_update_own_folder" ON storage.objects;
CREATE POLICY "avatars_update_own_folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "avatars_delete_own_folder" ON storage.objects;
CREATE POLICY "avatars_delete_own_folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  );

COMMENT ON POLICY "avatars_public_read" ON storage.objects IS
  'Anyone can read profile images (public bucket).';
COMMENT ON POLICY "avatars_insert_own_folder" ON storage.objects IS
  'Authenticated users may upload only under {auth.uid()}/...';

-- Only updates avatar_url for the current auth user (no broad UPDATE on public.users for clients).
CREATE OR REPLACE FUNCTION public.set_user_avatar(p_url text)
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
    avatar_url = NULLIF(trim(p_url), ''),
    updated = now()
  WHERE auth_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'No profile row for this user';
  END IF;
END;
$$;

ALTER FUNCTION public.set_user_avatar(text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.set_user_avatar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_avatar(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_avatar(text) TO service_role;

COMMENT ON FUNCTION public.set_user_avatar(text) IS
  'Sets public.users.avatar_url for the current auth user. Clients upload to Storage first, then pass the public URL.';
