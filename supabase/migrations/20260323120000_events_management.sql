-- Events management: visibility, status, flyer, end time; permission seed; storage for flyers.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS end_time timestamptz,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS flyer_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_status_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_status_check
      CHECK (status IN ('active', 'cancelled'));
  END IF;
END $$;

COMMENT ON COLUMN public.events.flyer_url IS 'Public URL for event flyer image in storage bucket assets/flyers/.';
COMMENT ON COLUMN public.events.status IS 'active or cancelled; cancelled events remain visible for admins.';

INSERT INTO public.permissions (name, description)
VALUES (
  'manage_events',
  'Create, edit, cancel events, manage flyers, and sync with Google Calendar.'
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Public read for flyer URLs
DROP POLICY IF EXISTS "assets_public_read" ON storage.objects;
CREATE POLICY "assets_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'assets');

-- Authenticated uploads under flyers/
DROP POLICY IF EXISTS "assets_flyers_insert_authenticated" ON storage.objects;
CREATE POLICY "assets_flyers_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assets'
    AND name LIKE 'flyers/%'
  );

DROP POLICY IF EXISTS "assets_flyers_update_authenticated" ON storage.objects;
CREATE POLICY "assets_flyers_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'assets' AND name LIKE 'flyers/%')
  WITH CHECK (bucket_id = 'assets' AND name LIKE 'flyers/%');
