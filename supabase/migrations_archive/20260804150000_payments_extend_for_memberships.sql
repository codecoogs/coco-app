-- Extend the existing payments table to support the in-app membership
-- Checkout flow (plan doc Section 6). payments keeps its role as the flat
-- transaction ledger; memberships is the business-level "what does this user
-- have" record, linked back via membership_id.

-- The pending row is inserted at Checkout Session creation time (plan doc
-- Section 3, step 4), before the member has entered payment details - so a
-- payment intent is not always available yet at insert time.
alter table public.payments
  alter column stripe_payment_intent_id drop not null;

alter table public.payments
  add column if not exists membership_id uuid,
  -- Not in the plan doc's Section 6 column table, but Section 3 step 2
  -- requires looking up "an existing pending payment for this user + plan" -
  -- impossible without a plan reference on the row itself, since a
  -- membership doesn't exist yet at that point in the flow.
  add column if not exists plan_id uuid,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists currency text not null default 'usd';

alter table public.payments
  add constraint payments_membership_id_fkey
  foreign key (membership_id) references public.memberships (id) on delete set null;

alter table public.payments
  add constraint payments_plan_id_fkey
  foreign key (plan_id) references public.membership_plans (id) on delete restrict;

create index if not exists payments_plan_id_idx on public.payments (plan_id);

alter table public.memberships
  add constraint memberships_payment_id_fkey
  foreign key (payment_id) references public.payments (id) on delete set null;

create unique index if not exists payments_stripe_checkout_session_id_unique
  on public.payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists payments_stripe_payment_intent_id_idx
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists payments_membership_id_idx on public.payments (membership_id);
create index if not exists payments_user_id_idx on public.payments (user_id);

-- Standardize status values going forward. Existing rows (backfilled via
-- populate_payments_from_users) are left as-is rather than force-migrated,
-- since their actual status text isn't guaranteed to map cleanly - this
-- constraint only governs new writes.
alter table public.payments
  add constraint payments_status_check
  check (status is null or status in ('pending', 'succeeded', 'failed', 'refunded'))
  not valid;
