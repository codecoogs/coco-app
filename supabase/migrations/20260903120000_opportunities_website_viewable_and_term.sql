-- Opportunities shown on the public codecoogs.com site are a curated subset of
-- what the admin app manages, so is_active (live in the admin app) is not the
-- same question as "should this appear on the website". website_viewable gates
-- the public site and defaults to false, so nothing becomes public by accident.
--
-- term/opens_on/closes_on carry the application-window wording the website
-- already renders per card (e.g. "Spring 2026"); expires_at stays the internal
-- auto-hide date and is unaffected.

alter table public.opportunities
  add column if not exists website_viewable boolean not null default false,
  add column if not exists term text,
  add column if not exists opens_on date,
  add column if not exists closes_on date;

comment on column public.opportunities.website_viewable is
  'Whether this opportunity may be shown on the public website. Distinct from is_active, which is whether it is live in the admin app at all.';
comment on column public.opportunities.term is
  'Human-readable application window shown on the website card (e.g. "Spring 2026").';

create index if not exists opportunities_website_viewable_idx
  on public.opportunities (website_viewable, is_active);

-- Recreate the public read view to expose the new columns. CREATE OR REPLACE VIEW can
-- only append columns, not reposition or rename existing ones — the new columns go at
-- the end, after is_internal, keeping every preceding column identical to
-- 20260828150000_active_opportunities_sort_internal_first. The internal-first ordering
-- from that migration is preserved.
create or replace view public.active_opportunities with (security_invoker = on) as
select
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
  field,
  linked_form_id,
  (linked_form_id is not null) as is_internal,
  website_viewable,
  term,
  opens_on,
  closes_on
from public.opportunities
where is_active = true and (expires_at is null or expires_at > now())
order by is_internal desc, display_order;
