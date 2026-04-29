-- Team image uploads (assets/team-images/*) for authenticated dashboard users.

-- Ensure assets bucket exists and remains public (public read policy already in events migration).
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "assets_team_images_insert_authenticated" ON storage.objects;
CREATE POLICY "assets_team_images_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assets'
    AND name LIKE 'team-images/%'
  );

DROP POLICY IF EXISTS "assets_team_images_update_authenticated" ON storage.objects;
CREATE POLICY "assets_team_images_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'assets' AND name LIKE 'team-images/%')
  WITH CHECK (bucket_id = 'assets' AND name LIKE 'team-images/%');

DROP POLICY IF EXISTS "assets_team_images_delete_authenticated" ON storage.objects;
CREATE POLICY "assets_team_images_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'assets' AND name LIKE 'team-images/%');

COMMENT ON POLICY "assets_team_images_insert_authenticated" ON storage.objects IS
  'Allow authenticated uploads for team images under assets/team-images/.';
