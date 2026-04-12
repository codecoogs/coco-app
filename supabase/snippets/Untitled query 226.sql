INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
    1,
    p.id
FROM public.permissions p
WHERE p.name IN (
    'view_academic_years',
    'view_active_opportunities',
    'view_branches',
    'view_events',
    'view_events_attendance',
    'view_events_attending',
    'view_leaderboard',
    'view_leaderboards_teams',
    'view_officer_profiles',
    'view_opportunities',
    'view_permissions',
    'view_point_categories',
    'view_point_transactions',
    'view_points',
    'view_position_permissions',
    'view_positions',
    'view_projects',
    'view_roles',
    'view_teams',
    'view_teams_leads',
    'view_teams_members',
    'view_todos',
    'view_todos_users',
    'view_user_profile',
    'view_users'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;