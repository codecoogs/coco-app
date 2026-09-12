-- Fixes a hole in public.has_permission(), which 125 policy expressions across
-- 25 tables still call.
--
-- The old body joined role_permissions like this:
--
--   LEFT JOIN public.role_permissions rp ON rp.role_id = (
--     SELECT role_id FROM public.users WHERE id = u.id
--   )
--
-- public.users has no role_id column, so Postgres resolved the bare role_id
-- against the enclosing query instead, where rp.role_id is in scope. The
-- condition became rp.role_id = rp.role_id - always true - so the join matched
-- every row in role_permissions and the function answered "yes" for any
-- permission granted to any role, to every signed-in user.
--
-- Measured on the dev branch before this migration: an Events Logistics
-- Officer got has_permission('manage_positions') = true, while the correct
-- helper, current_user_has_permission('manage_positions'), returned false.
--
-- The app was not visibly broken because every server action also checks
-- permissions in TypeScript. RLS is the boundary that actually matters though:
-- the anon key is public, so any signed-in member could query PostgREST
-- directly and reach users, payments, and the permission tables themselves.
--
-- Rather than rewrite 125 policy expressions, the function now delegates to
-- current_user_has_permission(), which every migration since the baseline
-- already uses. Every policy that calls it becomes correct at once.
--
-- That is a tightening, and it has a consequence worth stating plainly:
-- permissions resolve through the position a member holds, and ordinary
-- members hold none. The grants on the 'member' and 'guest' roles are
-- unreachable in that model, so members were reading events, the leaderboard
-- and their own points ONLY through this bug. Section 2 gives them policies
-- that grant that access on purpose, scoped to their own rows.

-- ---------------------------------------------------------------------------
-- 1. The fix
-- ---------------------------------------------------------------------------

create or replace function public.has_permission(perm_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_permission(perm_name);
$$;

comment on function public.has_permission(text) is
  'Deprecated alias kept because many baseline policies call it. Delegates to current_user_has_permission(); do not use in new policies.';

-- ---------------------------------------------------------------------------
-- 2. What members are allowed to see, stated explicitly
--
-- Each of these tables had exactly one SELECT policy, the permission check
-- above, so without these a member would lose access the moment section 1
-- takes effect.
-- ---------------------------------------------------------------------------

-- Events a member can attend are the public ones. Officers keep the wider
-- view through view_events.
drop policy if exists events_select_public on public.events;
create policy events_select_public on public.events for select to authenticated
  using (is_public is true);

-- Your own RSVP, and the ability to make or withdraw one.
drop policy if exists events_attending_select_own on public.events_attending;
create policy events_attending_select_own on public.events_attending for select to authenticated
  using (user_id = public.current_public_user_id());

drop policy if exists events_attending_insert_own on public.events_attending;
create policy events_attending_insert_own on public.events_attending for insert to authenticated
  with check (user_id = public.current_public_user_id());

drop policy if exists events_attending_delete_own on public.events_attending;
create policy events_attending_delete_own on public.events_attending for delete to authenticated
  using (user_id = public.current_public_user_id());

-- Your own check-ins.
drop policy if exists events_attendance_select_own on public.events_attendance;
create policy events_attendance_select_own on public.events_attendance for select to authenticated
  using (user_id = public.current_public_user_id());

-- A leaderboard nobody can read is not a leaderboard.
drop policy if exists leaderboard_select_authenticated on public.leaderboard;
create policy leaderboard_select_authenticated on public.leaderboard for select to authenticated
  using (true);

-- The officers page is a directory; any signed-in member may read it.
drop policy if exists officer_profiles_select_authenticated on public.officer_profiles;
create policy officer_profiles_select_authenticated on public.officer_profiles for select to authenticated
  using (true);

-- Your own points and the history behind them.
drop policy if exists points_select_own on public.points;
create policy points_select_own on public.points for select to authenticated
  using (user_id = public.current_public_user_id());

drop policy if exists point_transactions_select_own on public.point_transactions;
create policy point_transactions_select_own on public.point_transactions for select to authenticated
  using (user_id = public.current_public_user_id());

-- Your own profile row, readable and editable. Officers keep the wider view
-- through view_users, which every position already holds.
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users for select to authenticated
  using (id = public.current_public_user_id());

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users for update to authenticated
  using (id = public.current_public_user_id())
  with check (id = public.current_public_user_id());
