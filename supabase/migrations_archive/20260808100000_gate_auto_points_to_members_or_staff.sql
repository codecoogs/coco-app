-- Automatic point awards should only apply to paid members or staff
-- (officers/execs/admins/interns) - not to a signed-in-but-unpaid regular
-- user. This is a soft gate: it only affects automatic DB-triggered awards.
-- The "Team Participation" bonus (20260429160000, rescoped per-year in
-- 20260807120000) is currently the only automatic point award in the
-- system - manual admin grants via Point Management are untouched and can
-- still award points to anyone an admin chooses.
--
-- Staff eligibility mirrors lib/types/rbac.ts's isStaffRole(): is_admin, or
-- position title / role name containing intern/officer/executive/admin,
-- read from the user_profile view (same source of truth the app uses).

create or replace function public.award_team_participation_points_for_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_id uuid;
  v_current_year_id uuid;
  v_eligible boolean;
  sys_uid uuid := '00000000-0000-0000-0000-000000000001'::uuid;
begin
  select
    exists (
      select 1
      from public.memberships m
      where m.user_id = new.user_id
        and m.status = 'active'
        and m.ends_at >= current_date
    )
    or exists (
      select 1
      from public.user_profile up
      where up.user_id = new.user_id
        and (
          up.is_admin
          or lower(coalesce(up."positionTitle", '') || ' ' || coalesce(up.role_name, ''))
             ~ '(intern|officer|executive|admin)'
        )
    )
  into v_eligible;

  if not v_eligible then
    return new;
  end if;

  select pc.id
  into v_category_id
  from public.point_categories pc
  where pc.id = 'e9633368-5080-4f25-9caa-0c7b14df2f53'::uuid
     or lower(trim(pc.name)) = lower(trim('Team Participation'))
  order by
    case
      when pc.id = 'e9633368-5080-4f25-9caa-0c7b14df2f53'::uuid then 0
      else 1
    end
  limit 1;

  if v_category_id is null then
    raise warning 'award_team_participation_points_for_member: Team Participation point category not found';
    return new;
  end if;

  select id into v_current_year_id from public.academic_years where is_current = true limit 1;

  if exists (
    select 1
    from public.point_transactions t
    where t.user_id = new.user_id
      and t.category_id = v_category_id
      and t.academic_year_id is not distinct from v_current_year_id
  ) then
    return new;
  end if;

  insert into public.point_transactions (
    user_id,
    category_id,
    points_earned,
    created_by,
    updated_by
  )
  values (
    new.user_id,
    v_category_id,
    null,
    sys_uid,
    sys_uid
  );

  return new;
end;
$$;
