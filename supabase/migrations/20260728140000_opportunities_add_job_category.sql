-- Add a 'Job' category for external job/career postings (e.g. CSV-imported
-- LinkedIn listings), distinct from 'Internship' (still usable for curated
-- internship-specific postings) and the internal Club Role / Project / Sponsor
-- categories.

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_category_check;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_category_check
  CHECK (
    category = ANY (
      ARRAY['Internship'::text, 'Club Role'::text, 'Project'::text, 'Sponsor'::text, 'Job'::text, 'Other'::text]
    )
  );
