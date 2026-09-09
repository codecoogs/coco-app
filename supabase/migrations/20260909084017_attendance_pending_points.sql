-- QR attendance: non-members can check in, but their points stay pending until
-- they buy a membership.
--
-- point_transactions.status:
--   'applied' - counts toward points and the leaderboard (the default, so every
--               existing row and every non-attendance code path is unaffected).
--   'pending' - recorded and visible to the member, worth zero until a
--               membership activates.

alter table public.point_transactions
  add column if not exists status text not null default 'applied';

alter table public.point_transactions
  drop constraint if exists point_transactions_status_check;
alter table public.point_transactions
  add constraint point_transactions_status_check check (status in ('applied', 'pending'));

comment on column public.point_transactions.status is
  'applied = counts toward leaderboard; pending = awaiting a membership (see apply_pending_points_on_membership).';

-- Attendance -> points. Same as before except the status decision at the end:
-- a member gets points now, a non-member gets a pending row.
create or replace function public.create_point_transaction_on_attendance()
returns trigger
language plpgsql
as $$
DECLARE
  v_category_id uuid;
  v_points_value integer;
  v_academic_year_id uuid;
  v_status text;
BEGIN
  SELECT pc.id, pc.points_value
  INTO v_category_id, v_points_value
  FROM events e
  JOIN point_categories pc ON pc.name = e.point_category
  WHERE e.id = NEW.event_id;

  -- Event has no point category: attendance is still recorded, no points.
  IF v_category_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_academic_year_id
  FROM academic_years
  WHERE now() BETWEEN start_date AND end_date
  LIMIT 1;

  -- Matches hasActiveMembership() in lib/supabase/membership.ts.
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = NEW.user_id
      AND m.status = 'active'
      AND m.ends_at >= current_date
  ) THEN 'applied' ELSE 'pending' END
  INTO v_status;

  INSERT INTO point_transactions (
    user_id, category_id, event_id, points_earned,
    academic_year_id, created_by, updated_by, status
  ) VALUES (
    NEW.user_id, v_category_id, NEW.event_id, v_points_value,
    v_academic_year_id, NEW.created_by, NEW.updated_by, v_status
  );

  RETURN NEW;
END;
$$;

-- Leaderboard totals ignore pending rows. Both sums must filter, or the
-- INSERT and the ON CONFLICT UPDATE disagree.
create or replace function public.update_leaderboard_ranks()
returns trigger
language plpgsql
as $$
DECLARE
  current_year_id uuid;
BEGIN
  SELECT id INTO current_year_id
  FROM public.academic_years
  WHERE is_current = true
  LIMIT 1;

  INSERT INTO public.leaderboard (user_id, total_points)
  VALUES (
    NEW.user_id,
    (
      SELECT coalesce(sum(points_earned), 0)
      FROM public.point_transactions
      WHERE user_id = NEW.user_id
        AND academic_year_id = current_year_id
        AND status = 'applied'
    )
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = (
      SELECT coalesce(sum(points_earned), 0)
      FROM public.point_transactions
      WHERE user_id = NEW.user_id
        AND academic_year_id = current_year_id
        AND status = 'applied'
    );

  UPDATE public.leaderboard lb
  SET
    current_rank = sub.new_rank::integer,
    points_tie_group_size = sub.tie_cnt::integer
  FROM (
    SELECT
      user_id,
      rank() OVER (ORDER BY total_points DESC NULLS LAST, user_id) AS new_rank,
      count(*) OVER (PARTITION BY total_points) AS tie_cnt
    FROM public.leaderboard
  ) AS sub
  WHERE lb.user_id = sub.user_id;

  RETURN NEW;
END;
$$;

-- Membership goes active -> release that member's pending points.
-- Current academic year only: older years are settled history, and the
-- leaderboard only reads the current year anyway.
create or replace function public.apply_pending_points_on_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
  current_year_id uuid;
BEGIN
  IF NEW.status <> 'active' OR NEW.ends_at < current_date THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO current_year_id
  FROM public.academic_years
  WHERE is_current = true
  LIMIT 1;

  -- Row-at-a-time so update_leaderboard_ranks fires per row, as it does
  -- everywhere else.
  UPDATE public.point_transactions
  SET status = 'applied', updated_at = now()
  WHERE user_id = NEW.user_id
    AND status = 'pending'
    AND academic_year_id = current_year_id;

  RETURN NEW;
END;
$$;

comment on function public.apply_pending_points_on_membership() is
  'Releases this academic year''s pending point_transactions when a membership becomes active.';

drop trigger if exists tr_apply_pending_points on public.memberships;
create trigger tr_apply_pending_points
  after insert or update of status on public.memberships
  for each row execute function public.apply_pending_points_on_membership();
