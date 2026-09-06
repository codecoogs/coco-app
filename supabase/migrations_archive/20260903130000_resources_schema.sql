-- Learning materials (workshop slides, notebooks, reference sheets) that the
-- website currently ships as a generated static file. Moving them into a table
-- lets the admin app curate them, with website_viewable gating what the public
-- site shows — the same split opportunities uses.
--
-- Column names/audit shape mirror semesters and opportunities rather than the
-- website's current camelCase static data.

create table if not exists public.resources (
  id uuid default gen_random_uuid() not null primary key,

  title text not null,
  description text,
  category text not null,
  link_url text not null,

  extension text,
  thumbnail_url text,
  resource_date date,

  display_order integer not null default 0,

  website_viewable boolean not null default false,
  is_active boolean not null default true,

  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resources_website_viewable_idx
  on public.resources (website_viewable, is_active);

create index if not exists resources_category_idx
  on public.resources (category);

create or replace function public.resources_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists resources_set_updated_at_trg on public.resources;
create trigger resources_set_updated_at_trg
before update on public.resources
for each row
execute function public.resources_set_updated_at();

-- Writes go through the service role (GoGo) for now. When the admin app grows a
-- resources UI it will need a manage_resources permission and matching write
-- policies, following the opportunities pattern.
alter table public.resources enable row level security;

drop policy if exists resources_select_active on public.resources;
create policy resources_select_active
  on public.resources
  for select
  to authenticated
  using (is_active = true);
