-- Account administration (auth.users) as its own permission.
--
-- Marking an email verified bypasses the ownership proof the OTP flow
-- otherwise requires, so it should not ride along with manage_memberships -
-- that one is held by everyone who edits member and payment records, which is
-- a wider group than should hold a verify button.
--
-- Granted to whoever already holds manage_officers: the same people who
-- administer roles and permissions.
--
-- No RLS policies here. auth.users is not reachable through PostgREST at all;
-- the Accounts tab goes through the service-role client inside a server
-- action, which checks this permission in code before it touches anything.

insert into public.permissions (id, name, description)
select gen_random_uuid(), 'manage_accounts',
       'View sign-in accounts and mark an email address verified'
where not exists (select 1 from public.permissions where name = 'manage_accounts');

insert into public.role_permissions (role_id, permission_id)
select rp.role_id, new_perm.id
from public.role_permissions rp
join public.permissions old_perm
  on old_perm.id = rp.permission_id and old_perm.name = 'manage_officers'
cross join public.permissions new_perm
where new_perm.name = 'manage_accounts'
on conflict (role_id, permission_id) do nothing;

insert into public.position_permissions (position_id, permission_id)
select pp.position_id, new_perm.id
from public.position_permissions pp
join public.permissions old_perm
  on old_perm.id = pp.permission_id and old_perm.name = 'manage_officers'
cross join public.permissions new_perm
where new_perm.name = 'manage_accounts'
on conflict (position_id, permission_id) do nothing;
