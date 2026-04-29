-- Teams directory + team-lead self-management policies.
-- - All authenticated users can view teams/rosters/leads.
-- - Team leads can update their own team row.
-- - manage_teams permission can manage any team row.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS team_image_url text;

COMMENT ON COLUMN public.teams.team_image_url IS
  'Public image URL shown on teams directory and my-team pages.';

INSERT INTO public.permissions (name, description)
VALUES
  ('view_teams', 'View all teams, descriptions, and team rosters.'),
  ('manage_teams', 'Manage teams and edit team details (or own team when lead).')
ON CONFLICT (name) DO NOTHING;

DROP POLICY IF EXISTS "teams_select_authenticated" ON public.teams;
CREATE POLICY "teams_select_authenticated"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "teams_update_lead_or_manage_teams" ON public.teams;
CREATE POLICY "teams_update_lead_or_manage_teams"
  ON public.teams
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_has_permission('manage_teams')
    OR EXISTS (
      SELECT 1
      FROM public.teams_leads tl
      JOIN public.users u ON u.id = tl.user_id
      WHERE tl.team_id = teams.id
        AND u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_user_has_permission('manage_teams')
    OR EXISTS (
      SELECT 1
      FROM public.teams_leads tl
      JOIN public.users u ON u.id = tl.user_id
      WHERE tl.team_id = teams.id
        AND u.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teams_members_select_authenticated" ON public.teams_members;
CREATE POLICY "teams_members_select_authenticated"
  ON public.teams_members
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "teams_leads_select_authenticated" ON public.teams_leads;
CREATE POLICY "teams_leads_select_authenticated"
  ON public.teams_leads
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "teams_select_authenticated" ON public.teams IS
  'Authenticated users can view all team records.';

COMMENT ON POLICY "teams_update_lead_or_manage_teams" ON public.teams IS
  'Team leads may update their own team; manage_teams can update any team.';

COMMENT ON POLICY "teams_members_select_authenticated" ON public.teams_members IS
  'Authenticated users can view team membership rosters.';

COMMENT ON POLICY "teams_leads_select_authenticated" ON public.teams_leads IS
  'Authenticated users can view team lead assignments.';
