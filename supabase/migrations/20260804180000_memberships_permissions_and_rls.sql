-- RLS for the membership Checkout feature (plan doc Section 6).
-- Reuses the existing view_memberships / manage_memberships permissions and
-- the current_public_user_id() / current_user_has_permission() helpers - no
-- new permission names needed.

-- membership_plans: the catalog is readable by any authenticated member
-- (they need to see what's purchasable), managed by manage_memberships.
alter table public.membership_plans enable row level security;

drop policy if exists membership_plans_select on public.membership_plans;
create policy membership_plans_select
  on public.membership_plans
  for select
  to authenticated
  using (true);

drop policy if exists membership_plans_insert on public.membership_plans;
create policy membership_plans_insert
  on public.membership_plans
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_memberships'));

drop policy if exists membership_plans_update on public.membership_plans;
create policy membership_plans_update
  on public.membership_plans
  for update
  to authenticated
  using (public.current_user_has_permission('manage_memberships'))
  with check (public.current_user_has_permission('manage_memberships'));

-- memberships: self-row read for the Settings tab, admin read via
-- manage_memberships. No client-side writes - only the process_stripe_event
-- SECURITY DEFINER function (via service-role) creates/updates these.
alter table public.memberships enable row level security;

drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own
  on public.memberships
  for select
  to authenticated
  using (user_id = public.current_public_user_id());

drop policy if exists memberships_select_manage on public.memberships;
create policy memberships_select_manage
  on public.memberships
  for select
  to authenticated
  using (public.current_user_has_permission('manage_memberships'));

-- payments: self-row read, admin read, and a narrow self-scoped INSERT so the
-- checkout-creation server action (running as the signed-in user, not
-- service-role) can write the initial pending row itself. No UPDATE/DELETE
-- policies - status transitions only happen via process_stripe_event.
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own
  on public.payments
  for select
  to authenticated
  using (user_id = public.current_public_user_id());

drop policy if exists payments_select_manage on public.payments;
create policy payments_select_manage
  on public.payments
  for select
  to authenticated
  using (public.current_user_has_permission('manage_memberships'));

drop policy if exists payments_insert_own_pending on public.payments;
create policy payments_insert_own_pending
  on public.payments
  for insert
  to authenticated
  with check (
    user_id = public.current_public_user_id()
    and status = 'pending'
  );

-- stripe_events: audit log for the webhook only. No policies for
-- authenticated/anon - service-role (used by process_stripe_event) bypasses
-- RLS entirely, so this table is unreadable/unwritable by any client.
alter table public.stripe_events enable row level security;
