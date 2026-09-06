-- Advancing academic_years.is_current to a new row does nothing to
-- public.leaderboard today - update_leaderboard_ranks() (see
-- 20260429170000_leaderboard_points_tie_group.sql) only fires on
-- point_transactions DML, so per-user totals stay frozen at the old year's
-- values until each member individually earns a point in the new year.
-- Mid-rollover this would rank stale old-year totals against fresh
-- new-year totals as if comparable.
--
-- This adds a trigger on academic_years itself: whenever a row becomes the
-- current year (insert or is_current flipped true), bulk-recompute every
-- leaderboard row's total_points from that year's point_transactions (0 for
-- anyone with none yet) and re-rank the whole table, mirroring the same
-- ranking logic update_leaderboard_ranks() already uses.

create or replace function public.recompute_leaderboard_on_year_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_year_id uuid;
begin
  -- Only the row that becomes current triggers a recompute; the "clear the
  -- old current row" update (is_current true -> false) is a no-op here.
  if new.is_current is not true then
    return new;
  end if;

  select id into v_current_year_id from public.academic_years where is_current = true limit 1;

  -- Reset total_points to the new year's sum (0 if none yet) for every user
  -- who already has a leaderboard row, plus anyone who already has
  -- point_transactions in the new year but no leaderboard row yet.
  insert into public.leaderboard (user_id, total_points)
  select
    u.id,
    coalesce(sum(pt.points_earned) filter (where pt.academic_year_id = v_current_year_id), 0)
  from public.users u
  left join public.point_transactions pt on pt.user_id = u.id
  where u.id in (select user_id from public.leaderboard)
     or u.id in (
       select user_id from public.point_transactions where academic_year_id = v_current_year_id
     )
  group by u.id
  on conflict (user_id) do update set total_points = excluded.total_points;

  update public.leaderboard lb
  set current_rank = sub.new_rank::integer,
      points_tie_group_size = sub.tie_cnt::integer
  from (
    select user_id,
      rank() over (order by total_points desc nulls last, user_id) as new_rank,
      count(*) over (partition by total_points) as tie_cnt
    from public.leaderboard
  ) as sub
  where lb.user_id = sub.user_id;

  return new;
end;
$$;

drop trigger if exists academic_years_recompute_leaderboard_trg on public.academic_years;
create trigger academic_years_recompute_leaderboard_trg
after insert or update of is_current on public.academic_years
for each row
when (new.is_current = true)
execute function public.recompute_leaderboard_on_year_change();
