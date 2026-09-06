-- Record the manage_opportunities grants that were made in the dashboard.
--
-- 20260728130000 seeded manage_opportunities to Executive/Admin only, but the
-- live database has it on all 29 positions and 4 roles — officer and intern were
-- added by hand afterwards. Nothing in the migration history says so, which means
-- rebuilding this database from migrations (a fresh environment, or a restore)
-- would silently drop 24 of the 29 grants and leave most officers unable to
-- manage postings.
--
-- This is a no-op against the current database. It exists so the intent is
-- recorded and survives a rebuild.

insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
join public.roles r on r.id = p.role_id
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin', 'officer', 'intern')
  and perm.name = 'manage_opportunities'
on conflict (position_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, perm.id
from public.roles r
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin', 'officer', 'intern')
  and perm.name = 'manage_opportunities'
on conflict (role_id, permission_id) do nothing;
