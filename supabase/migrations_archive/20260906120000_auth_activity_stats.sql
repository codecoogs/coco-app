-- Sign-in activity for the executive dashboard.
--
-- public.users records that an account exists (created by the
-- on_auth_user_created trigger) but knows nothing about whether anyone ever
-- came back and signed in - that lives in auth.users, which is not exposed
-- through PostgREST. This function bridges the gap the same way
-- sync_oauth_profile_to_public_user does: SECURITY DEFINER, reading auth
-- directly, returning only aggregates so no PII crosses the wire.
--
-- Caveat worth knowing before building anything else on this: auth.users
-- stores only the MOST RECENT sign-in, not a history. These counts are
-- "accounts whose last sign-in falls in the window", which is a distinct-user
-- count, not a login count. Per-event history would have to come from
-- auth.audit_log_entries, which is retention-limited.

create or replace function public.get_auth_activity_stats()
returns table (active_7d integer, active_30d integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Raise rather than filter. A permission check in the WHERE clause of an
  -- aggregate query returns zeros for an unauthorized caller, which reads as
  -- "nobody signed in" instead of "you may not see this".
  if not public.current_user_has_permission('view_executive_dashboard') then
    raise exception 'permission denied: view_executive_dashboard is required';
  end if;

  return query
  select
    count(*) filter (
      where u.last_sign_in_at >= now() - interval '7 days'
    )::integer,
    count(*) filter (
      where u.last_sign_in_at >= now() - interval '30 days'
    )::integer
  from auth.users u
  where u.deleted_at is null;
end;
$$;

comment on function public.get_auth_activity_stats() is
  'Distinct accounts whose most recent sign-in falls in the last 7/30 days. Aggregates only - never returns per-user rows. Requires view_executive_dashboard.';

-- SECURITY DEFINER runs as the owner, so execute must be granted narrowly.
revoke all on function public.get_auth_activity_stats() from public, anon;
grant execute on function public.get_auth_activity_stats() to authenticated;
