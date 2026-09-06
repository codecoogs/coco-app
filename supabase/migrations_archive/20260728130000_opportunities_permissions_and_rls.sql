-- Opportunities feature: admin management permission + RLS for member browsing / admin CRUD.
-- RLS was already enabled on public.opportunities with zero policies (deny-all for
-- non-service-role callers) — this is why the page has been empty regardless of data.

insert into public.permissions (name, description)
values
  (
    'manage_opportunities',
    'Create, edit, import (CSV), and activate/deactivate job/opportunity postings.'
  )
on conflict (name) do nothing;

-- Seed permission to privileged roles (Executive/Admin + is_admin positions),
-- same pattern used for tickets/events/forms.
insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
join public.roles r on r.id = p.role_id
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name = 'manage_opportunities'
on conflict (position_id, permission_id) do nothing;

insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
cross join public.permissions perm
where p.is_admin is true
  and perm.name = 'manage_opportunities'
on conflict (position_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, perm.id
from public.roles r
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name = 'manage_opportunities'
on conflict (role_id, permission_id) do nothing;

-- RLS ------------------------------------------------------------------

-- Members: read only active, unexpired postings (mirrors active_opportunities' own
-- filter, so the same rule applies whether querying the view or the base table).
drop policy if exists opportunities_select_active on public.opportunities;
create policy opportunities_select_active
  on public.opportunities
  for select
  to authenticated
  using (
    is_active is true
    and (expires_at is null or expires_at > now())
  );

-- Admins: read everything, including inactive/pending-review imported rows.
drop policy if exists opportunities_select_manage on public.opportunities;
create policy opportunities_select_manage
  on public.opportunities
  for select
  to authenticated
  using (public.current_user_has_permission('manage_opportunities'));

drop policy if exists opportunities_insert_manage on public.opportunities;
create policy opportunities_insert_manage
  on public.opportunities
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_opportunities'));

drop policy if exists opportunities_update_manage on public.opportunities;
create policy opportunities_update_manage
  on public.opportunities
  for update
  to authenticated
  using (public.current_user_has_permission('manage_opportunities'))
  with check (public.current_user_has_permission('manage_opportunities'));

drop policy if exists opportunities_delete_manage on public.opportunities;
create policy opportunities_delete_manage
  on public.opportunities
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_opportunities'));

comment on policy opportunities_select_active on public.opportunities is
  'Any authenticated member can browse active, unexpired postings.';
comment on policy opportunities_select_manage on public.opportunities is
  'manage_opportunities holders (officers/execs/admins) can see all postings, including inactive ones pending review after a CSV import.';
