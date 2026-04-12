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
            'todos_users', 'user_positions', 'role_permissions'
        ])
    LOOP
        EXECUTE format('
            ALTER TABLE public.%I
                ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS updated_by   UUID REFERENCES public.users(id) DEFAULT ''00000000-0000-0000-0000-000000000001'',
                ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES public.users(id) DEFAULT ''00000000-0000-0000-0000-000000000001'';
        ', t);
    END LOOP;
END;
$$;