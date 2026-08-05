-- membership_plans no longer owns its own starts_at/ends_at - dates are
-- derived from a linked semester (kind = 'semester') or academic year
-- (kind = 'yearly'), so there's one place to correct a date instead of one
-- per plan. No existing rows reference the dropped columns (table is empty).

alter table public.membership_plans
  drop column if exists starts_at,
  drop column if exists ends_at;

alter table public.membership_plans
  add column if not exists semester_id uuid references public.semesters (id) on delete restrict,
  add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;

alter table public.membership_plans
  add constraint membership_plans_period_matches_kind check (
    (kind = 'semester' and semester_id is not null and academic_year_id is null)
    or
    (kind = 'yearly' and academic_year_id is not null and semester_id is null)
  );

create index if not exists membership_plans_semester_id_idx on public.membership_plans (semester_id);
create index if not exists membership_plans_academic_year_id_idx on public.membership_plans (academic_year_id);
