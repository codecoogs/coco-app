-- Finance feature: income/expense ledger fed by Stripe (memberships, sponsors)
-- and manual entries (TDECU bank account), plus lightweight budgeting.
-- Receipt photo capture is a future effort; finance_transactions.receipt_path
-- is reserved for it now to avoid a later migration.

create table if not exists public.finance_categories (
  id uuid default gen_random_uuid() not null primary key,
  name text not null,
  type text not null,
  constraint finance_categories_type_check check (type in ('income', 'expense')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_categories_name_type_unique unique (name, type)
);

create table if not exists public.finance_sponsors (
  id uuid default gen_random_uuid() not null primary key,
  name text not null,
  contact_name text,
  contact_email text,
  -- Stripe customer id for the sponsor, when payments are collected via Stripe.
  stripe_customer_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The source a transaction is tied to: a Stripe product line or the manual bank feed.
create table if not exists public.finance_accounts (
  id uuid default gen_random_uuid() not null primary key,
  name text not null,
  type text not null,
  constraint finance_accounts_type_check check (
    type in ('stripe_memberships', 'stripe_sponsors', 'tdecu_manual')
  ),
  -- Stripe account/connected-account id, when type is stripe_*. Null for manual.
  external_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Core ledger. Auditing columns follow the tickets/point_transactions convention
-- (created_by/updated_by + created_on/updated_on) since this is a record that
-- gets corrected/verified after the fact, not just created once.
create table if not exists public.finance_transactions (
  id uuid default gen_random_uuid() not null primary key,

  account_id uuid not null references public.finance_accounts (id) on delete restrict,
  category_id uuid references public.finance_categories (id) on delete set null,

  direction text not null,
  constraint finance_transactions_direction_check check (direction in ('income', 'expense')),

  amount_cents bigint not null,
  constraint finance_transactions_amount_positive check (amount_cents > 0),
  currency text not null default 'usd',

  description text,
  occurred_at timestamptz not null default now(),

  -- Optional linkage: which member paid (dues) or which sponsor paid (sponsorship).
  member_id uuid references public.users (id) on delete set null,
  sponsor_id uuid references public.finance_sponsors (id) on delete set null,

  source text not null,
  constraint finance_transactions_source_check check (source in ('stripe', 'manual')),
  -- Stripe charge/invoice/payment_intent id, for webhook idempotency. Null for manual entries.
  stripe_object_id text,

  -- Reserved for the future receipt photo upload feature (Storage object path).
  receipt_path text,

  -- Manual (TDECU) entries start unverified until a second exec checks them
  -- against the bank statement. Stripe-sourced rows are considered self-verifying.
  status text not null default 'unverified',
  constraint finance_transactions_status_check check (status in ('unverified', 'verified')),
  verified_by uuid references public.users (id) on delete set null,
  verified_at timestamptz,

  created_by uuid not null references public.users (id) on delete restrict,
  updated_by uuid references public.users (id) on delete set null,
  created_on timestamptz not null default now(),
  updated_on timestamptz not null default now()
);

create unique index if not exists finance_transactions_stripe_object_id_unique
  on public.finance_transactions (stripe_object_id)
  where stripe_object_id is not null;

create index if not exists finance_transactions_account_id_idx on public.finance_transactions (account_id);
create index if not exists finance_transactions_category_id_idx on public.finance_transactions (category_id);
create index if not exists finance_transactions_member_id_idx on public.finance_transactions (member_id);
create index if not exists finance_transactions_sponsor_id_idx on public.finance_transactions (sponsor_id);
create index if not exists finance_transactions_occurred_at_idx on public.finance_transactions (occurred_at);

-- Planned vs. actual spend per category per academic year (reuses the existing
-- academic_years table already used by points/teams, instead of a new period concept).
create table if not exists public.finance_budgets (
  id uuid default gen_random_uuid() not null primary key,
  category_id uuid not null references public.finance_categories (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  planned_amount_cents bigint not null,
  constraint finance_budgets_planned_amount_non_negative check (planned_amount_cents >= 0),
  notes text,
  created_by uuid not null references public.users (id) on delete restrict,
  updated_by uuid references public.users (id) on delete set null,
  created_on timestamptz not null default now(),
  updated_on timestamptz not null default now(),
  constraint finance_budgets_category_year_unique unique (category_id, academic_year_id)
);

-- Raw Stripe webhook audit trail, for debugging membership/sponsor payment sync
-- and to make ingestion idempotent (stripe_event_id is unique).
create table if not exists public.finance_stripe_sync_log (
  id uuid default gen_random_uuid() not null primary key,
  account_id uuid references public.finance_accounts (id) on delete set null,
  stripe_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint finance_stripe_sync_log_event_id_unique unique (stripe_event_id)
);

-- Keep updated_at/updated_on current across the feature's mutable tables.
create or replace function public.finance_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.finance_set_updated_on()
returns trigger
language plpgsql
as $$
begin
  new.updated_on = now();
  return new;
end;
$$;

drop trigger if exists finance_categories_set_updated_at_trg on public.finance_categories;
create trigger finance_categories_set_updated_at_trg
before update on public.finance_categories
for each row
execute function public.finance_set_updated_at();

drop trigger if exists finance_sponsors_set_updated_at_trg on public.finance_sponsors;
create trigger finance_sponsors_set_updated_at_trg
before update on public.finance_sponsors
for each row
execute function public.finance_set_updated_at();

drop trigger if exists finance_accounts_set_updated_at_trg on public.finance_accounts;
create trigger finance_accounts_set_updated_at_trg
before update on public.finance_accounts
for each row
execute function public.finance_set_updated_at();

drop trigger if exists finance_transactions_set_updated_on_trg on public.finance_transactions;
create trigger finance_transactions_set_updated_on_trg
before update on public.finance_transactions
for each row
execute function public.finance_set_updated_on();

drop trigger if exists finance_budgets_set_updated_on_trg on public.finance_budgets;
create trigger finance_budgets_set_updated_on_trg
before update on public.finance_budgets
for each row
execute function public.finance_set_updated_on();
