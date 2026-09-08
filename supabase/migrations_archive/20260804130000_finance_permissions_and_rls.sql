-- Finance feature permissions and RLS.
-- current_user_has_permission() already exists (20260406120000_role_permissions_user_profile.sql).

insert into public.permissions (name, description)
values
  (
    'view_finances',
    'View finance dashboard: transaction ledger, categories, sponsors, and budgets.'
  ),
  (
    'manage_finances',
    'Create/edit/delete transactions, categories, sponsors, and budgets; verify manual entries.'
  ),
  (
    'manage_finance_sources',
    'Configure finance accounts (Stripe sources, bank account) and view Stripe sync logs. Narrower than manage_finances.'
  )
on conflict (name) do nothing;

-- Seed to privileged roles (Executive/Admin + is_admin positions), same pattern
-- used for tickets/forms/etc. manage_finances / manage_finance_sources can be
-- narrowed to a specific Treasurer position afterward via the Permissions admin UI.
insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
join public.roles r on r.id = p.role_id
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name in ('view_finances', 'manage_finances', 'manage_finance_sources')
on conflict (position_id, permission_id) do nothing;

insert into public.position_permissions (position_id, permission_id)
select p.id, perm.id
from public.positions p
cross join public.permissions perm
where p.is_admin is true
  and perm.name in ('view_finances', 'manage_finances', 'manage_finance_sources')
on conflict (position_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, perm.id
from public.roles r
cross join public.permissions perm
where lower(r.name) in ('executive', 'admin')
  and perm.name in ('view_finances', 'manage_finances', 'manage_finance_sources')
on conflict (role_id, permission_id) do nothing;

-- finance_categories -----------------------------------------------------

alter table public.finance_categories enable row level security;

drop policy if exists finance_categories_select on public.finance_categories;
create policy finance_categories_select
  on public.finance_categories
  for select
  to authenticated
  using (public.current_user_has_permission('view_finances'));

drop policy if exists finance_categories_insert on public.finance_categories;
create policy finance_categories_insert
  on public.finance_categories
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_finances'));

drop policy if exists finance_categories_update on public.finance_categories;
create policy finance_categories_update
  on public.finance_categories
  for update
  to authenticated
  using (public.current_user_has_permission('manage_finances'))
  with check (public.current_user_has_permission('manage_finances'));

drop policy if exists finance_categories_delete on public.finance_categories;
create policy finance_categories_delete
  on public.finance_categories
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_finances'));

-- finance_sponsors ---------------------------------------------------------

alter table public.finance_sponsors enable row level security;

drop policy if exists finance_sponsors_select on public.finance_sponsors;
create policy finance_sponsors_select
  on public.finance_sponsors
  for select
  to authenticated
  using (public.current_user_has_permission('view_finances'));

drop policy if exists finance_sponsors_insert on public.finance_sponsors;
create policy finance_sponsors_insert
  on public.finance_sponsors
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_finances'));

drop policy if exists finance_sponsors_update on public.finance_sponsors;
create policy finance_sponsors_update
  on public.finance_sponsors
  for update
  to authenticated
  using (public.current_user_has_permission('manage_finances'))
  with check (public.current_user_has_permission('manage_finances'));

drop policy if exists finance_sponsors_delete on public.finance_sponsors;
create policy finance_sponsors_delete
  on public.finance_sponsors
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_finances'));

-- finance_accounts -----------------------------------------------------
-- Narrower: configuring sources needs manage_finance_sources, not just manage_finances.

alter table public.finance_accounts enable row level security;

drop policy if exists finance_accounts_select on public.finance_accounts;
create policy finance_accounts_select
  on public.finance_accounts
  for select
  to authenticated
  using (public.current_user_has_permission('view_finances'));

drop policy if exists finance_accounts_insert on public.finance_accounts;
create policy finance_accounts_insert
  on public.finance_accounts
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_finance_sources'));

drop policy if exists finance_accounts_update on public.finance_accounts;
create policy finance_accounts_update
  on public.finance_accounts
  for update
  to authenticated
  using (public.current_user_has_permission('manage_finance_sources'))
  with check (public.current_user_has_permission('manage_finance_sources'));

drop policy if exists finance_accounts_delete on public.finance_accounts;
create policy finance_accounts_delete
  on public.finance_accounts
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_finance_sources'));

-- finance_transactions -----------------------------------------------------

alter table public.finance_transactions enable row level security;

drop policy if exists finance_transactions_select on public.finance_transactions;
create policy finance_transactions_select
  on public.finance_transactions
  for select
  to authenticated
  using (public.current_user_has_permission('view_finances'));

drop policy if exists finance_transactions_insert on public.finance_transactions;
create policy finance_transactions_insert
  on public.finance_transactions
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_finances'));

drop policy if exists finance_transactions_update on public.finance_transactions;
create policy finance_transactions_update
  on public.finance_transactions
  for update
  to authenticated
  using (public.current_user_has_permission('manage_finances'))
  with check (public.current_user_has_permission('manage_finances'));

drop policy if exists finance_transactions_delete on public.finance_transactions;
create policy finance_transactions_delete
  on public.finance_transactions
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_finances'));

-- finance_budgets -----------------------------------------------------

alter table public.finance_budgets enable row level security;

drop policy if exists finance_budgets_select on public.finance_budgets;
create policy finance_budgets_select
  on public.finance_budgets
  for select
  to authenticated
  using (public.current_user_has_permission('view_finances'));

drop policy if exists finance_budgets_insert on public.finance_budgets;
create policy finance_budgets_insert
  on public.finance_budgets
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_finances'));

drop policy if exists finance_budgets_update on public.finance_budgets;
create policy finance_budgets_update
  on public.finance_budgets
  for update
  to authenticated
  using (public.current_user_has_permission('manage_finances'))
  with check (public.current_user_has_permission('manage_finances'));

drop policy if exists finance_budgets_delete on public.finance_budgets;
create policy finance_budgets_delete
  on public.finance_budgets
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_finances'));

-- finance_stripe_sync_log -----------------------------------------------------
-- Webhook writes happen server-side via the service role (bypasses RLS).
-- Only the source-managers can read the raw sync log for debugging.

alter table public.finance_stripe_sync_log enable row level security;

drop policy if exists finance_stripe_sync_log_select on public.finance_stripe_sync_log;
create policy finance_stripe_sync_log_select
  on public.finance_stripe_sync_log
  for select
  to authenticated
  using (public.current_user_has_permission('manage_finance_sources'));
