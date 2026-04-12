INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
    5,
    p.id
FROM public.permissions p
WHERE p.name LIKE 'manage_%'
ON CONFLICT (role_id, permission_id) DO NOTHING;