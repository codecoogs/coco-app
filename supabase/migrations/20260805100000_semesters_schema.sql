-- Per-semester windows within an academic year, so membership_plans (and
-- future features) can derive dates from a single source of truth instead of
-- each typing in its own starts_at/ends_at. Mirrors academic_years' actual
-- current shape (that table has been extended with audit columns directly
-- in Supabase, beyond what its original migration defined - matched here for
-- consistency rather than the original bare-bones academic_years schema).

create table if not exists public.semesters (
  id uuid default gen_random_uuid() not null primary key,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,

  label text not null,
  term text not null,
  constraint semesters_term_check check (term in ('fall', 'spring', 'summer')),

  start_date date not null,
  end_date date not null,
  constraint semesters_dates_check check (end_date > start_date),

  is_current boolean not null default false,

  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint semesters_academic_year_term_unique unique (academic_year_id, term)
);

create index if not exists semesters_academic_year_id_idx on public.semesters (academic_year_id);

create or replace function public.semesters_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists semesters_set_updated_at_trg on public.semesters;
create trigger semesters_set_updated_at_trg
before update on public.semesters
for each row
execute function public.semesters_set_updated_at();

-- Read-only in the app - managed directly in Supabase like academic_years.
-- Mirrors academic_years' existing (dashboard-applied) broad-read policy:
-- any authenticated member can read semester windows.
alter table public.semesters enable row level security;

drop policy if exists semesters_select_authenticated on public.semesters;
create policy semesters_select_authenticated
  on public.semesters
  for select
  to authenticated
  using (true);
