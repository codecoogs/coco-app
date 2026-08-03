-- Discipline/search-keyword tag from CSV imports (e.g. "Data Science"), distinct
-- from the app-level `category` column (Internship/Club Role/Project/Sponsor/Job/Other).
-- Source CSVs carry both a `category` column (slug, e.g. "data-science") and a
-- `search_term` column (display form, e.g. "Data Science") for the same concept;
-- the importer prefers search_term and falls back to category.

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS field text;

COMMENT ON COLUMN public.opportunities.field IS
  'Discipline/search-keyword tag from a CSV import (e.g. "Data Science"). Distinct from category, which is the card-type bucket.';

-- Recreate the public read view to expose the new column. CREATE OR REPLACE VIEW can
-- only append columns, not reposition existing ones — field goes at the end.
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
  external_id,
  field
FROM public.opportunities
WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
ORDER BY display_order;
