-- Widen manage_resources to officers and interns.
--
-- 20260905120000 seeded it to Executive/Admin only, following the letter of the
-- opportunities migration. In practice the officers running a workshop are the
-- ones with the slides, so requiring an exec to publish them adds a handoff for
-- no safety gain — website_viewable already gates what reaches the public site,
-- and it defaults to false.
--
-- Roles are listed explicitly rather than granting to every position, so a
-- future member- or guest-scoped position does not silently inherit write
-- access.

insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
join public.roles r on r.id = p.role_id
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin', 'officer', 'intern')
  and perm.name = 'manage_resources'
on conflict (position_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, perm.id
from public.roles r
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin', 'officer', 'intern')
  and perm.name = 'manage_resources'
on conflict (role_id, permission_id) do nothing;
