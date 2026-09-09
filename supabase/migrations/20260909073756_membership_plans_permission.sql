-- Split manage_memberships into two permissions so the User Management page
-- (member/payment records) and the Membership plans page (plans, academic
-- years, semesters) can be granted independently.
--
-- manage_memberships       -> memberships, payments (User Management)
-- manage_membership_plans  -> membership_plans, academic_years, semesters

insert into public.permissions (id, name, description)
select gen_random_uuid(), 'manage_membership_plans',
       'Create and edit membership plans, academic years, and semesters'
where not exists (select 1 from public.permissions where name = 'manage_membership_plans');

-- Everyone who could manage plans before keeps that access.
insert into public.role_permissions (role_id, permission_id)
select rp.role_id, new_perm.id
from public.role_permissions rp
join public.permissions old_perm on old_perm.id = rp.permission_id and old_perm.name = 'manage_memberships'
cross join public.permissions new_perm
where new_perm.name = 'manage_membership_plans'
on conflict (role_id, permission_id) do nothing;

insert into public.position_permissions (position_id, permission_id)
select pp.position_id, new_perm.id
from public.position_permissions pp
join public.permissions old_perm on old_perm.id = pp.permission_id and old_perm.name = 'manage_memberships'
cross join public.permissions new_perm
where new_perm.name = 'manage_membership_plans'
on conflict (position_id, permission_id) do nothing;

-- RLS: the three plan-side tables now answer to the new permission.
drop policy if exists membership_plans_insert on public.membership_plans;
create policy membership_plans_insert on public.membership_plans
  for insert to authenticated
  with check (public.current_user_has_permission('manage_membership_plans'));

drop policy if exists membership_plans_update on public.membership_plans;
create policy membership_plans_update on public.membership_plans
  for update to authenticated
  using (public.current_user_has_permission('manage_membership_plans'))
  with check (public.current_user_has_permission('manage_membership_plans'));

drop policy if exists academic_years_insert on public.academic_years;
create policy academic_years_insert on public.academic_years
  for insert to authenticated
  with check (public.current_user_has_permission('manage_membership_plans'));

drop policy if exists academic_years_update on public.academic_years;
create policy academic_years_update on public.academic_years
  for update to authenticated
  using (public.current_user_has_permission('manage_membership_plans'))
  with check (public.current_user_has_permission('manage_membership_plans'));

drop policy if exists academic_years_delete on public.academic_years;
create policy academic_years_delete on public.academic_years
  for delete to authenticated
  using (public.current_user_has_permission('manage_membership_plans'));

drop policy if exists semesters_insert on public.semesters;
create policy semesters_insert on public.semesters
  for insert to authenticated
  with check (public.current_user_has_permission('manage_membership_plans'));

drop policy if exists semesters_update on public.semesters;
create policy semesters_update on public.semesters
  for update to authenticated
  using (public.current_user_has_permission('manage_membership_plans'))
  with check (public.current_user_has_permission('manage_membership_plans'));

drop policy if exists semesters_delete on public.semesters;
create policy semesters_delete on public.semesters
  for delete to authenticated
  using (public.current_user_has_permission('manage_membership_plans'));
