-- ============================================================
-- HELPER FUNCTION: Check if the current user has a permission
-- via either role_permissions or position_permissions
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(perm_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.users u

        -- Check role-based permissions
        LEFT JOIN public.role_permissions rp ON rp.role_id = (
            SELECT role_id FROM public.users WHERE id = u.id
        )
        LEFT JOIN public.permissions rp_perm ON rp.permission_id = rp_perm.id

        -- Check position-based permissions
        LEFT JOIN public.user_positions up ON up.user_id = u.id
        LEFT JOIN public.positions pos ON up."positionTitle" = pos.title
        LEFT JOIN public.position_permissions pp ON pp.position_id = pos.id
        LEFT JOIN public.permissions pp_perm ON pp.permission_id = pp_perm.id

        WHERE u.auth_id = auth.uid()
        AND (
            rp_perm.name  = perm_name
            OR pp_perm.name = perm_name
            OR pos.is_admin = TRUE  -- admins get everything
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- RLS POLICIES PER TABLE
-- ============================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'academic_years', 'branches', 'events', 'events_attendance',
            'events_attending', 'leaderboard', 'leaderboards_teams',
            'officer_profiles', 'opportunities', 'payments', 'permissions',
            'point_categories', 'point_transactions', 'points',
            'position_permissions', 'positions', 'projects', 'roles',
            'tasks', 'teams', 'teams_leads', 'teams_members', 'todos',
            'todos_users', 'user_positions', 'users', 'role_permissions'
        ])
    LOOP
        -- 1. Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

        -- 2. Drop existing policies to avoid conflicts on re-run
        EXECUTE format('DROP POLICY IF EXISTS "view_%s_policy"   ON public.%I;', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "manage_%s_insert" ON public.%I;', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "manage_%s_update" ON public.%I;', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "manage_%s_delete" ON public.%I;', t, t);

        -- 3. SELECT policy — requires view_<table> permission
        EXECUTE format('
            CREATE POLICY "view_%s_policy"
            ON public.%I
            FOR SELECT
            TO authenticated
            USING (public.has_permission(''view_%s''));
        ', t, t, t);

        -- 4. INSERT policy — requires manage_<table> permission
        EXECUTE format('
            CREATE POLICY "manage_%s_insert"
            ON public.%I
            FOR INSERT
            TO authenticated
            WITH CHECK (public.has_permission(''manage_%s''));
        ', t, t, t);

        -- 5. UPDATE policy — requires manage_<table> permission
        EXECUTE format('
            CREATE POLICY "manage_%s_update"
            ON public.%I
            FOR UPDATE
            TO authenticated
            USING     (public.has_permission(''manage_%s''))
            WITH CHECK (public.has_permission(''manage_%s''));
        ', t, t, t, t);

        -- 6. DELETE policy — requires manage_<table> permission
        EXECUTE format('
            CREATE POLICY "manage_%s_delete"
            ON public.%I
            FOR DELETE
            TO authenticated
            USING (public.has_permission(''manage_%s''));
        ', t, t, t);

    END LOOP;
END;
$$;