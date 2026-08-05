-- In-app membership purchases: admin-managed plan catalog + per-user membership
-- periods. See Membership_Stripe_Implementation_Plan.docx (Section 6) for the
-- full design. One-time Checkout payments per period - no auto-renewing
-- subscriptions, so each purchase is its own row and history is preserved.

-- Admin-managed catalog. Dates are fixed calendar windows tied to the academic
-- year (not "N days from purchase"), so next year's plan is a new row, not a
-- code change. Mirrors the point_categories / positions pattern in this app.
create table if not exists public.membership_plans (
  id uuid default gen_random_uuid() not null primary key,

  name text not null,
  kind text not null,
  constraint membership_plans_kind_check check (kind in ('semester', 'yearly')),

  stripe_price_id text not null,
  amount_cents integer not null,
  constraint membership_plans_amount_positive check (amount_cents > 0),

  starts_at date not null,
  ends_at date not null,
  constraint membership_plans_dates_check check (ends_at > starts_at),

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The per-user record - single source of truth for "what's this user's current
-- membership." One row per purchased period; a renewal is a new row, not an
-- overwrite, so "expired, then renewed" is preserved instead of lost.
create table if not exists public.memberships (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id uuid not null references public.membership_plans (id) on delete restrict,

  status text not null default 'pending',
  constraint memberships_status_check check (status in ('pending', 'active', 'expired', 'refunded')),

  -- Copied from the plan at purchase time, so a later edit to the plan's own
  -- dates doesn't retroactively change a membership someone already bought.
  starts_at date not null,
  ends_at date not null,

  -- Nullable to allow a future admin-granted comp membership (not built in
  -- this pass - see plan doc Section 11, Open Questions).
  payment_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memberships_user_id_idx on public.memberships (user_id);
create index if not exists memberships_plan_id_idx on public.memberships (plan_id);

create or replace function public.membership_tables_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists membership_plans_set_updated_at_trg on public.membership_plans;
create trigger membership_plans_set_updated_at_trg
before update on public.membership_plans
for each row
execute function public.membership_tables_set_updated_at();

drop trigger if exists memberships_set_updated_at_trg on public.memberships;
create trigger memberships_set_updated_at_trg
before update on public.memberships
for each row
execute function public.membership_tables_set_updated_at();
