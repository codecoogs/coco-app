-- Award "Team Participation" points when a user is added to teams_members.
-- Category: fixed id (chapter seed) OR name = 'Team Participation'.
-- At most one such transaction per user (dedupe by user_id + category_id).

CREATE OR REPLACE FUNCTION public.award_team_participation_points_for_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id uuid;
  sys_uid uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  SELECT pc.id
  INTO v_category_id
  FROM public.point_categories pc
  WHERE pc.id = 'e9633368-5080-4f25-9caa-0c7b14df2f53'::uuid
     OR lower(trim(pc.name)) = lower(trim('Team Participation'))
  ORDER BY
    CASE
      WHEN pc.id = 'e9633368-5080-4f25-9caa-0c7b14df2f53'::uuid THEN 0
      ELSE 1
    END
  LIMIT 1;

  IF v_category_id IS NULL THEN
    RAISE WARNING 'award_team_participation_points_for_member: Team Participation point category not found';
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.point_transactions t
    WHERE t.user_id = NEW.user_id
      AND t.category_id = v_category_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.point_transactions (
    user_id,
    category_id,
    points_earned,
    created_by,
    updated_by
  )
  VALUES (
    NEW.user_id,
    v_category_id,
    NULL,
    sys_uid,
    sys_uid
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.award_team_participation_points_for_member() OWNER TO postgres;

COMMENT ON FUNCTION public.award_team_participation_points_for_member() IS
  'After insert on teams_members: insert one point_transactions row for Team Participation if none exists for that user.';

DROP TRIGGER IF EXISTS teams_members_award_team_participation_points_trg ON public.teams_members;
CREATE TRIGGER teams_members_award_team_participation_points_trg
AFTER INSERT ON public.teams_members
FOR EACH ROW
EXECUTE FUNCTION public.award_team_participation_points_for_member();

COMMENT ON TRIGGER teams_members_award_team_participation_points_trg ON public.teams_members IS
  'Grants Team Participation category points when a user joins a team (teams_members insert).';

-- ---------------------------------------------------------------------------
-- Backfill: users already on a team who do not yet have this transaction.
-- ---------------------------------------------------------------------------
INSERT INTO public.point_transactions (
  user_id,
  category_id,
  points_earned,
  created_by,
  updated_by
)
SELECT
  tm.user_id,
  cat.id,
  NULL,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM public.teams_members tm
CROSS JOIN LATERAL (
  SELECT pc.id
  FROM public.point_categories pc
  WHERE pc.id = 'e9633368-5080-4f25-9caa-0c7b14df2f53'::uuid
     OR lower(trim(pc.name)) = lower(trim('Team Participation'))
  ORDER BY
    CASE
      WHEN pc.id = 'e9633368-5080-4f25-9caa-0c7b14df2f53'::uuid THEN 0
      ELSE 1
    END
  LIMIT 1
) cat
WHERE NOT EXISTS (
  SELECT 1
  FROM public.point_transactions pt
  WHERE pt.user_id = tm.user_id
    AND pt.category_id = cat.id
);
