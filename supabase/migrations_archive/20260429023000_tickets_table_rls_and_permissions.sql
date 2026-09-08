-- Ticketing system: user-submitted software tickets
-- Table includes auditing columns and status.

create table if not exists public.tickets (
  id uuid default gen_random_uuid() not null primary key,

  -- Audit / soft delete
  created_by uuid not null references public.users (id) on delete cascade,
  updated_by uuid references public.users (id) on delete set null,
  created_on timestamptz not null default now(),
  updated_on timestamptz not null default now(),
  is_active boolean not null default true,

  -- Ticket content
  status text not null default 'in_progress',
  category text not null default 'general',
  priority text not null default 'normal',
  title text not null,
  description text not null
);

-- Keep updated_on current.
create or replace function public.tickets_set_updated_on()
returns trigger
language plpgsql
as $$
begin
  new.updated_on = now();
  return new;
end;
$$;

drop trigger if exists tickets_set_updated_on_trg on public.tickets;
create trigger tickets_set_updated_on_trg
before update on public.tickets
for each row
execute function public.tickets_set_updated_on();

-- Permissions
insert into public.permissions (name, description)
values
  (
    'view_tickets',
    'View the ticketing page and read ticket status.'
  ),
  (
    'manage_tickets',
    'Manage tickets (e.g. update ticket status).'
  )
on conflict (name) do nothing;

-- Seed permissions to privileged roles (Executive/Admin + is_admin positions).
insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
join public.roles r on r.id = p.role_id
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name in ('view_tickets', 'manage_tickets')
on conflict (position_id, permission_id) do nothing;

insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
cross join public.permissions perm
where p.is_admin is true
  and perm.name in ('view_tickets', 'manage_tickets')
on conflict (position_id, permission_id) do nothing;

-- RLS
alter table public.tickets enable row level security;

-- Submitter can always read their own tickets (active or inactive).
drop policy if exists tickets_select_own on public.tickets;
create policy tickets_select_own
  on public.tickets
  for select
  to authenticated
  using (
    created_by = (
      select u.id
      from public.users u
      where u.auth_id = auth.uid()
      limit 1
    )
  );

-- Viewers can read active tickets.
drop policy if exists tickets_select_view on public.tickets;
create policy tickets_select_view
  on public.tickets
  for select
  to authenticated
  using (
    is_active is true
    and public.current_user_has_permission('view_tickets')
  );

-- Managers can read all tickets (active or inactive).
drop policy if exists tickets_select_manage on public.tickets;
create policy tickets_select_manage
  on public.tickets
  for select
  to authenticated
  using (
    public.current_user_has_permission('manage_tickets')
  );

-- Users can submit tickets for themselves.
drop policy if exists tickets_insert_own on public.tickets;
create policy tickets_insert_own
  on public.tickets
  for insert
  to authenticated
  with check (
    created_by = (
      select u.id
      from public.users u
      where u.auth_id = auth.uid()
      limit 1
    )
  );

-- Managers can update status.
drop policy if exists tickets_update_manage on public.tickets;
create policy tickets_update_manage
  on public.tickets
  for update
  to authenticated
  using (
    public.current_user_has_permission('manage_tickets')
  )
  with check (
    public.current_user_has_permission('manage_tickets')
  );

-- Managers can deactivate / delete.
drop policy if exists tickets_delete_manage on public.tickets;
create policy tickets_delete_manage
  on public.tickets
  for delete
  to authenticated
  using (
    public.current_user_has_permission('manage_tickets')
  );

-- Basic grants for the app.
grant select, insert, update, delete on public.tickets to authenticated;
grant select, insert, update, delete on public.tickets to service_role;

