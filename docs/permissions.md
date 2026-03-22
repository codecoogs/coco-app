# Dynamic permissions (RBAC)

This app uses **position-based permissions**: each position is linked to a set of permissions via `position_permissions`. The `user_profile` view returns the current user’s `permissions[]` (and role, is_admin). Tabs and actions are gated by these permission names.

## Database structure (already in place)

- **`permissions`** – `id` (uuid), `name` (text). Permission names used in code (e.g. `view_officers`, `manage_officers`).
- **`positions`** – `id`, `title`, `role_id` → roles, `is_admin`, etc.
- **`position_permissions`** – `position_id` → positions, `permission_id` → permissions. Many-to-many: which permissions a position has.
- **`user_positions`** – `user_id`, `positionTitle` → positions.title. Which position a user holds.
- **`user_profile`** (view) – Joins the above and returns per user: `positionTitle`, `role_name`, `is_admin`, `permissions` (array of permission names).

No schema change is required. You only need to **insert permission rows** and **link them to positions** via `position_permissions`.

## Permission naming convention

- **`view_<resource>`** – Can see the tab/page (read-only). Example: Officer has `view_officers` → sees Officers tab.
- **`manage_<resource>`** – Can create, edit, and set is_active (or equivalent). Example: Executive has `manage_officers` → can edit/create/deactivate officers.

Same idea for memberships: `view_memberships` (see tab) and `manage_memberships` (edit/create/deactivate).

## App-side structure

1. **Profile from `user_profile` view** – `fetchUserProfile(supabase, authId)` queries the view by `auth_id` (must match `supabase.auth.getUser().id`). Use the same when using RLS/security_invoker. Returns `null` if the user has no position; handle nulls (e.g. no positionTitle, empty permissions).

2. **Global permission store** – `ProfileContext` stores the result (positionTitle, role_name, is_admin, permissions). The navbar uses positionTitle and role_name from this store. Use the **`can(permissionName)`** helper from `useProfile()` or `useProfileOptional()` for UI protection: it returns `true` if `is_admin` or the permission is in the array.

3. **Permission names** – `lib/types/rbac.ts` defines `PERMISSION_NAMES` and `PermissionName`. These must match the `name` column in `public.permissions`.

4. **Helpers** – `hasPermission(profile, 'view_officers')`, or in components `can('view_officers')` from context. `hasAnyPermission`, `hasAllPermissions` for multi-check. Users with `is_admin` are treated as having all permissions.

5. **Sidebar** – Each nav item can have an optional `requiredPermission`. Only items where `can(requiredPermission)` is true (or no `requiredPermission`) are shown.

6. **Pages** – Use `can('view_officers')` or `hasPermission(profile, 'view_*')` to allow access. Use `can('manage_officers')` to show Edit / Create / Set inactive buttons; authorize mutations in server actions with the same check.

7. **Real-time updates** – Profile is re-fetched on auth state change and when the window regains focus. After officer mutations (add/edit/deactivate), the app calls `refetchProfile()` so if the current user’s position changed, permissions update immediately.

## Example: Officers tab

- **Officer** position: grant `view_officers` → sees Officers tab, read-only.
- **Executive** position: grant `view_officers` and `manage_officers` → sees Officers tab and can edit, create, set is_active.

On the Officers page:

- Render the list if the user has `view_officers` (or is_admin).
- Show “Add officer”, “Edit”, “Set inactive” only if the user has `manage_officers` (or is_admin).
- In the API/server action that updates officers, check `manage_officers` (or is_admin) before allowing create/update/delete.

## Example SQL: seed permissions and assign to positions

Run once (or via a migration) to create permission rows. Use your actual position `id`s from `public.positions`.

```sql
-- Insert permission names (idempotent: only if not exists)
INSERT INTO public.permissions (id, name, description)
SELECT gen_random_uuid(), 'view_officers', 'See Officers tab and list'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'view_officers');
INSERT INTO public.permissions (id, name, description)
SELECT gen_random_uuid(), 'manage_officers', 'Create, edit, and deactivate officers'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'manage_officers');
INSERT INTO public.permissions (id, name, description)
SELECT gen_random_uuid(), 'view_memberships', 'See Member memberships tab'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'view_memberships');
INSERT INTO public.permissions (id, name, description)
SELECT gen_random_uuid(), 'manage_memberships', 'Manage membership data'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'manage_memberships');

-- Example: give Officer position view_officers and view_memberships
-- (replace <position_id_officer> with real id from SELECT id, title FROM positions;)
INSERT INTO public.position_permissions (position_id, permission_id)
SELECT p.id, perm.id FROM public.positions p, public.permissions perm
WHERE p.title = 'Officer' AND perm.name = 'view_officers'
ON CONFLICT (position_id, permission_id) DO NOTHING;
INSERT INTO public.position_permissions (position_id, permission_id)
SELECT p.id, perm.id FROM public.positions p, public.permissions perm
WHERE p.title = 'Officer' AND perm.name = 'view_memberships'
ON CONFLICT (position_id, permission_id) DO NOTHING;

-- Example: give Executive position view + manage for officers and memberships
INSERT INTO public.position_permissions (position_id, permission_id)
SELECT p.id, perm.id FROM public.positions p, public.permissions perm
WHERE p.title = 'Executive' AND perm.name IN ('view_officers', 'manage_officers', 'view_memberships', 'manage_memberships')
ON CONFLICT (position_id, permission_id) DO NOTHING;
```

After changing `position_permissions`, users get updated permissions on next load (profile is loaded client-side from `user_profile`).

## Adding a new permission

1. Add the name to `PERMISSION_NAMES` in `lib/types/rbac.ts` (e.g. `"view_opportunities"`).
2. Insert a row into `public.permissions` with that `name`.
3. Link it to the right positions via `position_permissions`.
4. In the app, add `requiredPermission: "view_opportunities"` to the nav item and/or use `hasPermission(profile, 'view_opportunities')` and `hasPermission(profile, 'manage_opportunities')` on the page and in API/server actions.
