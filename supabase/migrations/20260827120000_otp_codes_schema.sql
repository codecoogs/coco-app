-- Central one-time-password table, used for both signup email verification
-- and password reset (replacing Supabase magic links for both). Owned
-- entirely by the app: our own expiry (env-var controlled), idempotent
-- resend, and usage tracking, independent of Supabase Auth's internal
-- token/link mechanism.
--
-- RLS is enabled with no policies: this table is only ever reachable via
-- the service-role client (lib/supabase/admin.ts) from server actions,
-- never exposed through PostgREST to anon/authenticated clients.

create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('signup', 'password_reset')),
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts int not null default 0,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enforces "at most one active code per (auth_id, purpose)" at the DB
-- level, which idempotent request/resend relies on.
create unique index otp_codes_active_idx
  on public.otp_codes (auth_id, purpose)
  where used_at is null;

create index otp_codes_auth_id_idx on public.otp_codes (auth_id);

alter table public.otp_codes enable row level security;
