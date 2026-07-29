-- Extend opportunities for job-shaped postings (company/location/employment type)
-- and CSV-import provenance/dedup tracking. Existing rows are unaffected (all
-- new columns are nullable or default to their current behavior).

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS salary text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunities_employment_type_check'
      AND conrelid = 'public.opportunities'::regclass
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_employment_type_check
      CHECK (employment_type IS NULL OR employment_type IN ('Full-time', 'Part-time', 'Internship', 'Contract'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunities_source_check'
      AND conrelid = 'public.opportunities'::regclass
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_source_check
      CHECK (source IN ('manual', 'csv_import'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Dedup key for re-imports (e.g. a LinkedIn job id). A standard unique constraint
-- allows any number of NULLs, so manually-entered rows (external_id IS NULL) are unaffected.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunities_external_id_key'
      AND conrelid = 'public.opportunities'::regclass
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_external_id_key UNIQUE (external_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.opportunities.company_name IS
  'Employer name for job-shaped opportunities; blank for Club Role/Project/Sponsor cards.';
COMMENT ON COLUMN public.opportunities.employment_type IS
  'Full-time/Part-time/Internship/Contract. Only meaningful when the card represents a job posting.';
COMMENT ON COLUMN public.opportunities.source IS
  'manual (admin-entered) or csv_import (bulk-imported, e.g. from a LinkedIn export).';
COMMENT ON COLUMN public.opportunities.external_id IS
  'Dedup key for re-imports, e.g. the source CSV''s linkedin_job_id. NULL for manual entries.';

-- Recreate the public read view to expose the new columns. CREATE OR REPLACE VIEW can only
-- append columns, not reposition existing ones — so the new columns go at the end, keeping
-- the original column order/names identical.
CREATE OR REPLACE VIEW public.active_opportunities WITH (security_invoker = on) AS
SELECT
  id,
  title,
  description,
  link_url,
  category,
  icon_url,
  is_active,
  display_order,
  expires_at,
  created_at,
  updated_at,
  created_by,
  updated_by,
  company_name,
  location,
  employment_type,
  salary,
  source,
  external_id
FROM public.opportunities
WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
ORDER BY display_order;
