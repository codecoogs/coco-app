INSERT INTO public.permissions (name, description) VALUES
-- academic_years
('view_academic_years', 'Permission to view academic years'),
('manage_academic_years', 'Permission to manage academic years'),

-- active_opportunities (view)
('view_active_opportunities', 'Permission to view active opportunities'),
('manage_active_opportunities', 'Permission to manage active opportunities'),

-- branches
('view_branches', 'Permission to view branches'),
('manage_branches', 'Permission to manage branches'),

-- events
('view_events', 'Permission to view events'),
('manage_events', 'Permission to manage events'),

-- events_attendance
('view_events_attendance', 'Permission to view events attendance'),
('manage_events_attendance', 'Permission to manage events attendance'),

-- events_attending
('view_events_attending', 'Permission to view events attending'),
('manage_events_attending', 'Permission to manage events attending'),

-- leaderboard
('view_leaderboard', 'Permission to view leaderboard'),
('manage_leaderboard', 'Permission to manage leaderboard'),

-- leaderboards_teams
('view_leaderboards_teams', 'Permission to view leaderboards teams'),
('manage_leaderboards_teams', 'Permission to manage leaderboards teams'),

-- officer_profiles
('view_officer_profiles', 'Permission to view officer profiles'),
('manage_officer_profiles', 'Permission to manage officer profiles'),

-- opportunities
('view_opportunities', 'Permission to view opportunities'),
('manage_opportunities', 'Permission to manage opportunities'),

-- payments
('view_payments', 'Permission to view payments'),
('manage_payments', 'Permission to manage payments'),

-- permissions
('view_permissions', 'Permission to view permissions'),
('manage_permissions', 'Permission to manage permissions'),

-- point_categories
('view_point_categories', 'Permission to view point categories'),
('manage_point_categories', 'Permission to manage point categories'),

-- point_transactions
('view_point_transactions', 'Permission to view point transactions'),
('manage_point_transactions', 'Permission to manage point transactions'),

-- points
('view_points', 'Permission to view points'),
('manage_points', 'Permission to manage points'),

-- position_permissions
('view_position_permissions', 'Permission to view position permissions'),
('manage_position_permissions', 'Permission to manage position permissions'),

-- positions
('view_positions', 'Permission to view positions'),
('manage_positions', 'Permission to manage positions'),

-- projects
('view_projects', 'Permission to view projects'),
('manage_projects', 'Permission to manage projects'),

-- roles
('view_roles', 'Permission to view roles'),
('manage_roles', 'Permission to manage roles'),

-- tasks
('view_tasks', 'Permission to view tasks'),
('manage_tasks', 'Permission to manage tasks'),

-- teams
('view_teams', 'Permission to view teams'),
('manage_teams', 'Permission to manage teams'),

-- teams_leads
('view_teams_leads', 'Permission to view teams leads'),
('manage_teams_leads', 'Permission to manage teams leads'),

-- teams_members
('view_teams_members', 'Permission to view teams members'),
('manage_teams_members', 'Permission to manage teams members'),

-- todos
('view_todos', 'Permission to view todos'),
('manage_todos', 'Permission to manage todos'),

-- todos_users
('view_todos_users', 'Permission to view todos users'),
('manage_todos_users', 'Permission to manage todos users'),

-- user_positions
('view_user_positions', 'Permission to view user positions'),
('manage_user_positions', 'Permission to manage user positions'),

-- user_profile (view)
('view_user_profile', 'Permission to view user profile'),
('manage_user_profile', 'Permission to manage user profile'),

-- users
('view_users', 'Permission to view users'),
('manage_users', 'Permission to manage users')

ON CONFLICT (name) DO NOTHING;