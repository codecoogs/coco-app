-- view_memberships / manage_memberships are referenced throughout this repo
-- (lib/types/rbac.ts, app/dashboard/memberships/page.tsx, and the new
-- memberships/payments RLS in 20260804180000) but were never actually seeded
-- as rows in public.permissions - today those checks only pass for is_admin
-- positions (current_user_has_permission short-circuits on is_admin), not
-- for Executives generally. Seeds them the same way as every other feature
-- in this app (see e.g. 20260721130000_forms_permissions.sql).

insert into public.permissions (name, description)
values
  (
    'view_memberships',
    'View membership status and history (Settings admin views, /dashboard/memberships).'
  ),
  (
    'manage_memberships',
    'Manage membership plans and view all members'' payment/membership records.'
  )
on conflict (name) do nothing;

insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
join public.roles r on r.id = p.role_id
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name in ('view_memberships', 'manage_memberships')
on conflict (position_id, permission_id) do nothing;

insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
cross join public.permissions perm
where p.is_admin is true
  and perm.name in ('view_memberships', 'manage_memberships')
on conflict (position_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, perm.id
from public.roles r
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name in ('view_memberships', 'manage_memberships')
on conflict (role_id, permission_id) do nothing;
