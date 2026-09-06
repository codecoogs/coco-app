-- Write access (create/edit/delete) for semesters and academic_years, gated
-- by manage_memberships - the same permission that already gates the
-- Membership plans admin page these periods feed into. Both tables were
-- previously "managed directly in Supabase" only (see
-- 20260805100000_semesters_schema.sql); this adds an in-app admin tab for
-- them instead.

-- academic_years was originally created without audit columns (see
-- 20260805100000's header comment); the live table has since been extended
-- to match semesters' shape. Codify that here so new environments stay in
-- sync, and so created_by/updated_by can be set from the new admin actions.
alter table public.academic_years
  add column if not exists created_by uuid references public.users (id) on delete set null,
  add column if not exists updated_by uuid references public.users (id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.academic_years_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists academic_years_set_updated_at_trg on public.academic_years;
create trigger academic_years_set_updated_at_trg
before update on public.academic_years
for each row
execute function public.academic_years_set_updated_at();

-- RLS was enabled for academic_years in the original schema migration, but
-- its select policy was applied directly in the Supabase dashboard (per
-- 20260805100000's comment) rather than checked into a migration. Re-declare
-- it here so it's captured going forward - safe alongside any existing
-- dashboard-applied policy of the same effect, since permissive select
-- policies for the same role are OR'd together, not replaced.
drop policy if exists academic_years_select_authenticated on public.academic_years;
create policy academic_years_select_authenticated
  on public.academic_years
  for select
  to authenticated
  using (true);

drop policy if exists academic_years_insert on public.academic_years;
create policy academic_years_insert
  on public.academic_years
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_memberships'));

drop policy if exists academic_years_update on public.academic_years;
create policy academic_years_update
  on public.academic_years
  for update
  to authenticated
  using (public.current_user_has_permission('manage_memberships'))
  with check (public.current_user_has_permission('manage_memberships'));

-- Deleting an academic year cascades to its semesters (semesters_academic_year_id_fkey)
-- and to finance_budgets (finance_budgets_academic_year_id_fkey) - and is
-- blocked by Postgres if any semester within it, or the year itself, is
-- still referenced by membership_plans (on delete restrict) or
-- point_transactions (no action). The admin UI warns about the cascade
-- before calling this.
drop policy if exists academic_years_delete on public.academic_years;
create policy academic_years_delete
  on public.academic_years
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_memberships'));

-- semesters already has its select policy (20260805100000); add write access.
drop policy if exists semesters_insert on public.semesters;
create policy semesters_insert
  on public.semesters
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_memberships'));

drop policy if exists semesters_update on public.semesters;
create policy semesters_update
  on public.semesters
  for update
  to authenticated
  using (public.current_user_has_permission('manage_memberships'))
  with check (public.current_user_has_permission('manage_memberships'));

-- Deleting a semester is blocked by Postgres if any membership_plans row
-- still references it (on delete restrict).
drop policy if exists semesters_delete on public.semesters;
create policy semesters_delete
  on public.semesters
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_memberships'));
