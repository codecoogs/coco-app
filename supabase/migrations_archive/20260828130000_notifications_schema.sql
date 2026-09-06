-- In-app notification system: a per-user notifications table, fanned out by
-- SECURITY DEFINER functions at the moment content actually becomes visible
-- to members (never a blind AFTER INSERT trigger — draft/inactive/imported
-- rows shouldn't notify anyone). Each fan-out function mirrors the exact
-- RLS visibility rule of the table it's for, so nobody is notified about
-- something they can't actually open.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_id_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (user_id = public.current_public_user_id());

create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (user_id = public.current_public_user_id())
  with check (user_id = public.current_public_user_id());

-- No insert policy for authenticated: rows are only ever created by the
-- SECURITY DEFINER fan-out functions below.
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;

-- Opt-in flag + idempotency guard for opportunities. notify_members defaults
-- off so importOpportunitiesCsv's bulk insert (and a later "activate all")
-- can't spam every member; notified_at ensures a given opportunity notifies
-- at most once no matter how many times it's toggled/edited afterward.
alter table public.opportunities
  add column notify_members boolean not null default false,
  add column notified_at timestamptz;

-- Idempotency guard for forms (no opt-in flag needed — "Publish" is already
-- a single deliberate action, there's no bulk-creation path like CSV import).
alter table public.forms
  add column notifications_sent_at timestamptz;

create or replace function public.notify_new_opportunity(p_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select
    u.id,
    'opportunity_posted',
    'New opportunity: ' || o.title,
    o.company_name,
    '/dashboard/opportunities'
  from public.opportunities o
  join public.users u on u.auth_id is not null
  where o.id = p_opportunity_id
    and o.notify_members = true
    and o.is_active = true
    and (o.expires_at is null or o.expires_at > now())
    and o.notified_at is null;

  update public.opportunities
  set notified_at = now()
  where id = p_opportunity_id
    and notify_members = true
    and is_active = true
    and (expires_at is null or expires_at > now())
    and notified_at is null;
end;
$$;

comment on function public.notify_new_opportunity(uuid) is
  'Fans out a notification to every account for an opportunity, once, when notify_members is on and it is actually visible (is_active, not expired). Safe to call unconditionally after any mutation.';

revoke all on function public.notify_new_opportunity(uuid) from public;
grant execute on function public.notify_new_opportunity(uuid) to authenticated, service_role;

create or replace function public.notify_form_published(p_form_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, link)
  select distinct
    u.id,
    'form_published',
    'New form: ' || f.title,
    '/dashboard/forms'
  from public.forms f
  join public.users u on u.auth_id is not null
  left join public.user_positions up
    on up.user_id = u.id and up.is_active is true
  left join public.positions pos
    on pos.title = up."positionTitle"
  where f.id = p_form_id
    and f.status = 'published'
    and f.is_active = true
    and f.notifications_sent_at is null
    and (
      f.audience_type = 'everyone'
      or (
        f.audience_type = 'roles'
        and exists (
          select 1 from public.form_audience_roles far
          where far.form_id = f.id and far.role_id = pos.role_id
        )
      )
      or (
        f.audience_type = 'positions'
        and exists (
          select 1 from public.form_audience_positions fap
          where fap.form_id = f.id and fap.position_id = pos.id
        )
      )
    );

  update public.forms
  set notifications_sent_at = now()
  where id = p_form_id
    and status = 'published'
    and is_active = true
    and notifications_sent_at is null;
end;
$$;

comment on function public.notify_form_published(uuid) is
  'Fans out a notification, once, to whoever is in a published form''s audience (everyone/roles/positions) — mirrors public.current_user_can_view_form(). Safe to call unconditionally after any mutation.';

revoke all on function public.notify_form_published(uuid) from public;
grant execute on function public.notify_form_published(uuid) to authenticated, service_role;
