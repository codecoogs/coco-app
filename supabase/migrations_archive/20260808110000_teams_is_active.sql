-- Soft-delete for teams: deactivating hides a team from the member-facing
-- /dashboard/teams directory without losing its data (name, roster history,
-- lead), unlike the existing hard delete. Mirrors the is_active pattern
-- already used by membership_plans and opportunities.

alter table public.teams
  add column if not exists is_active boolean not null default true;
