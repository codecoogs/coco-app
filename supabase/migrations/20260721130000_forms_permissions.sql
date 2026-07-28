-- Forms feature permissions.

insert into public.permissions (name, description)
values
  (
    'view_forms',
    'View the forms admin list (form metadata, status, response counts).'
  ),
  (
    'manage_forms',
    'Create, edit, publish/close, and view responses for forms.'
  )
on conflict (name) do nothing;

-- Seed permissions to privileged roles (Executive/Admin + is_admin positions),
-- same pattern used for tickets/events/etc.
insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
join public.roles r on r.id = p.role_id
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name in ('view_forms', 'manage_forms')
on conflict (position_id, permission_id) do nothing;

insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
cross join public.permissions perm
where p.is_admin is true
  and perm.name in ('view_forms', 'manage_forms')
on conflict (position_id, permission_id) do nothing;

-- Also grant via role_permissions so any position tied to the Executive/Admin role inherits it,
-- even positions created later (mirrors the role_permissions layer added in 20260406120000).
insert into public.role_permissions (role_id, permission_id)
select r.id, perm.id
from public.roles r
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name in ('view_forms', 'manage_forms')
on conflict (role_id, permission_id) do nothing;
