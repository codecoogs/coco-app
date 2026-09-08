-- Align public.teams / public.teams_leads with admin UI (additive; retains legacy columns e.g. points).
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users (id),
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users (id),
  ADD COLUMN IF NOT EXISTS academic_year uuid REFERENCES public.academic_years (id),
  ADD COLUMN IF NOT EXISTS team_number bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description text DEFAULT 'No description provided for this team :( ';

-- Legacy snapshot had teams.points NOT NULL; allow inserts via default when omitted.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'points'
  ) THEN
    ALTER TABLE public.teams ALTER COLUMN points SET DEFAULT 0;
  END IF;
END $$;

ALTER TABLE public.teams_leads
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users (id),
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users (id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teams_leads_team_id_fkey'
      AND conrelid = 'public.teams_leads'::regclass
  ) THEN
    ALTER TABLE public.teams_leads
      ADD CONSTRAINT teams_leads_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams (id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teams_leads_user_id_fkey'
      AND conrelid = 'public.teams_leads'::regclass
  ) THEN
    ALTER TABLE public.teams_leads
      ADD CONSTRAINT teams_leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
