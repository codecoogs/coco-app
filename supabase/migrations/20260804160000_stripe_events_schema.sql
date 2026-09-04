-- Webhook audit/idempotency log for the membership Checkout flow (plan doc
-- Section 6). This is what answers "what's pending / denied / retried" for
-- membership payments specifically - distinct from finance_stripe_sync_log,
-- which is the club-finance ledger's own audit trail for Stripe events. The
-- two are kept separate since they serve different bounded concerns (payment
-- state machine vs. income/expense ledger), even though a single event (e.g.
-- a membership purchase) can be relevant to both and so may be logged in each.

create table if not exists public.stripe_events (
  id uuid default gen_random_uuid() not null primary key,
  stripe_event_id text not null,
  type text not null,

  status text not null default 'received',
  constraint stripe_events_status_check check (status in ('received', 'processed', 'failed')),

  payload jsonb not null,
  error text,

  received_at timestamptz not null default now(),
  processed_at timestamptz,

  constraint stripe_events_event_id_unique unique (stripe_event_id)
);

create index if not exists stripe_events_type_idx on public.stripe_events (type);
