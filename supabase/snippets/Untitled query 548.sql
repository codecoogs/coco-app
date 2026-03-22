-- 1. Enable RLS on the table
alter table public.user_positions enable row level security;

-- 2. Create the "Management" policy
create policy "Officers with manage_officer permission can update officer positions"
on public.user_positions
for update -- This covers editing existing assignments
to authenticated
using (
  -- AUTHORIZATION CHECK: Does the LOGGED-IN user have 'manage_officer'?
  exists (
    select 1 from public.user_positions up_actor
    join public.positions p_actor on up_actor."positionTitle" = p_actor.title
    join public.position_permissions pp on p_actor.id = pp.position_id
    join public.permissions perm on pp.permission_id = perm.id
    where up_actor.user_id = (select id from public.users where auth_id = auth.uid())
    and (p_actor.is_admin = true or perm.name = 'manage_officer')
  )
)
with check (
  -- TARGET CHECK: Ensure they are only editing someone with the 'officer' role
  exists (
    select 1 from public.positions p_target
    join public.roles r_target on p_target.role_id = r_target.id
    where p_target.title = public.user_positions."positionTitle"
    and r_target.name = 'officer'
  )
);