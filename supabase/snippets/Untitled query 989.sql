    -- Read-only events page access (pair with manage_events for full CRUD in app).
INSERT INTO public.permissions (name, description)
VALUES (
  'view_events',
  'View the events management page. Use manage_events to create, edit, or cancel events.'
)
ON CONFLICT (name) DO NOTHING;
