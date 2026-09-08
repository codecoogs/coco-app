-- Unlike point_transactions, teams_members has no academic-year concept at
-- all today (no academic_year_id column, and a UNIQUE(user_id) constraint
-- means a member can only ever be on one team, period). Mirror the points
-- reset (20260807110000): whenever a row becomes the current academic year,
-- clear every team's roster and leads so members start the new year
-- unassigned. Team entities themselves (name/description/image/team_number)
-- are untouched - only who's assigned to them resets.

create or replace function public.reset_team_rosters_on_year_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_current is not true then
    return new;
  end if;

  delete from public.teams_members;
  delete from public.teams_leads;

  return new;
end;
$$;

drop trigger if exists academic_years_reset_team_rosters_trg on public.academic_years;
create trigger academic_years_reset_team_rosters_trg
after insert or update of is_current on public.academic_years
for each row
when (new.is_current = true)
execute function public.reset_team_rosters_on_year_change();

-- The one-time "Team Participation" point bonus (20260429160000) was
-- deduped per user for life (by user_id + category_id only), so a member
-- re-assigned to a team next year - now that rosters reset yearly - would
-- never earn it again. Rescope the dedup to the current academic year, so
-- being (re)assigned to a team in a new year awards it again, consistent
-- with everything else now resetting yearly. The trigger definition itself
-- is unchanged - only the function body.
create or replace function public.award_team_participation_points_for_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_id uuid;
  v_current_year_id uuid;
  sys_uid uuid := '00000000-0000-0000-0000-000000000001'::uuid;
begin
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
