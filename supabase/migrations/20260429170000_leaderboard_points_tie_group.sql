-- Tie counts for leaderboard: users with identical total_points share rank() from Postgres.
-- Store points_tie_group_size so pagination can show "(tied)" correctly.

ALTER TABLE public.leaderboard
ADD COLUMN IF NOT EXISTS points_tie_group_size integer;

COMMENT ON COLUMN public.leaderboard.points_tie_group_size IS
  'How many members share this total_points (same tie cohort as rank()); 1 = sole place at this score.';

CREATE OR REPLACE FUNCTION public.update_leaderboard_ranks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
    )
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = (
      SELECT coalesce(sum(points_earned), 0)
      FROM public.point_transactions
      WHERE user_id = NEW.user_id
        AND academic_year_id = current_year_id
    );

  UPDATE public.leaderboard lb
  SET
    current_rank = sub.new_rank::integer,
    points_tie_group_size = sub.tie_cnt::integer
  FROM (
    SELECT
      user_id,
      rank() OVER (
        ORDER BY total_points DESC NULLS LAST,
          user_id
      ) AS new_rank,
      count(*) OVER (PARTITION BY total_points) AS tie_cnt
    FROM public.leaderboard
  ) AS sub
  WHERE lb.user_id = sub.user_id;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.update_leaderboard_ranks() OWNER TO postgres;

-- Backfill ranks and tie sizes for existing rows.
UPDATE public.leaderboard lb
SET
  current_rank = sub.new_rank::integer,
  points_tie_group_size = sub.tie_cnt::integer
FROM (
  SELECT
    user_id,
    rank() OVER (
      ORDER BY total_points DESC NULLS LAST,
        user_id
    ) AS new_rank,
    count(*) OVER (PARTITION BY total_points) AS tie_cnt
  FROM public.leaderboard
) AS sub
WHERE lb.user_id = sub.user_id;
