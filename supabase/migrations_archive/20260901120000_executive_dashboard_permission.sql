-- Executive dashboard: member growth, sign-up, membership, and form
-- submission charts. Read-only, no new tables - just a permission gate.

insert into public.permissions (name, description)
values (
  'view_executive_dashboard',
  'View the executive dashboard: member growth, sign-up, membership, and form submission charts.'
)
on conflict (name) do nothing;

-- Seed to Executive/Admin roles, same pattern used for finance/membership
-- features (see 20260804130000_finance_permissions_and_rls.sql,
-- 20260804190000_seed_membership_permissions.sql).
insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
join public.roles r on r.id = p.role_id
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name = 'view_executive_dashboard'
on conflict (position_id, permission_id) do nothing;

-- Also seed is_admin positions directly. Functionally redundant (is_admin
-- already bypasses every permission check), but matches precedent so the
-- Permissions admin UI - which reads position_permissions directly - shows
-- this as checked for Admin positions instead of looking unset.
insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
cross join public.permissions perm
where p.is_admin is true
  and perm.name = 'view_executive_dashboard'
on conflict (position_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, perm.id
from public.roles r
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name = 'view_executive_dashboard'
on conflict (role_id, permission_id) do nothing;
