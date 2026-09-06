-- Resources admin: management permission + RLS write policies.
--
-- 20260903130000 created public.resources with RLS on and a single read policy
-- for active rows, so the only writer today is the service role (GoGo). An admin
-- UI needs authenticated officers to write directly, which means a permission and
-- matching policies — the same shape opportunities uses.

insert into public.permissions (name, description)
values
  (
    'manage_resources',
    'Create, edit, and activate/deactivate learning resources, and flag which appear on the website.'
  )
on conflict (name) do nothing;

-- Seed permission to privileged roles (Executive/Admin + is_admin positions),
-- same pattern used for opportunities/tickets/events/forms.
insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
join public.roles r on r.id = p.role_id
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name = 'manage_resources'
on conflict (position_id, permission_id) do nothing;

insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
cross join public.permissions perm
where p.is_admin is true
  and perm.name = 'manage_resources'
on conflict (position_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, perm.id
from public.roles r
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name = 'manage_resources'
on conflict (role_id, permission_id) do nothing;

-- RLS ------------------------------------------------------------------

-- Members: read only active resources. Recreated here rather than left as-is so
-- this migration describes the table's full policy set in one place.
drop policy if exists resources_select_active on public.resources;
create policy resources_select_active
  on public.resources
  for select
  to authenticated
  using (is_active is true);

-- Admins: read everything, including deactivated rows that members cannot see.
drop policy if exists resources_select_manage on public.resources;
create policy resources_select_manage
  on public.resources
  for select
  to authenticated
  using (public.current_user_has_permission('manage_resources'));

drop policy if exists resources_insert_manage on public.resources;
create policy resources_insert_manage
  on public.resources
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_resources'));

drop policy if exists resources_update_manage on public.resources;
create policy resources_update_manage
  on public.resources
  for update
  to authenticated
  using (public.current_user_has_permission('manage_resources'))
  with check (public.current_user_has_permission('manage_resources'));

drop policy if exists resources_delete_manage on public.resources;
create policy resources_delete_manage
  on public.resources
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_resources'));

comment on policy resources_select_active on public.resources is
  'Any authenticated member can browse active resources. website_viewable is not checked here: it gates the public site, not the member-facing app.';
comment on policy resources_select_manage on public.resources is
  'manage_resources holders (officers/execs/admins) can see all resources, including deactivated ones.';
