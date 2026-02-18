-- View used by fetchUserProfile(). Query by auth_id (Supabase Auth user id).
-- public.users links auth to app: users.id (app user), users.auth_id (Supabase auth user id).
-- user_positions.user_id is FK to public.users.id, so we join through users to filter by auth_id.

drop view if exists user_profile;

create view user_profile as
select
  u.auth_id,
  up.user_id,
  up."positionTitle" as "positionTitle",
  r.name as role_name,
  p.is_admin,
  coalesce(
    array_agg(perm.name) filter (where perm.id is not null),
    array[]::text[]
  ) as permissions
from public.user_positions up
join public.users u on up.user_id = u.id
join public.positions p on up."positionTitle" = p.title
left join public.roles r on p.role_id = r.id
left join public.position_permissions pp on p.id = pp.position_id
left join public.permissions perm on pp.permission_id = perm.id
group by u.auth_id, up.user_id, up."positionTitle", r.name, p.is_admin, p.id;

-- Optional: alter view user_profile set (security_invoker = on);
