-- Create the SELECT policy
create policy "Users can view officer positions if they have permission"
on public.user_positions
for select
to authenticated
using (
  -- 1. Can always see your own row
  (user_id = (select id from public.users where auth_id = auth.uid()))
  
  -- 2. OR check if user has necessary permissions/admin status
  or exists (
    select 1 from public.user_positions up_actor
    join public.positions p_actor on up_actor."positionTitle" = p_actor.title
    left join public.position_permissions pp on p_actor.id = pp.position_id
    left join public.permissions perm on pp.permission_id = perm.id
    where up_actor.user_id = (select id from public.users where auth_id = auth.uid())
    and (
      p_actor.is_admin = true 
      or perm.name in ('view_officers', 'manage_officers')
    )
  )
);