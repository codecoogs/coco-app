-- A record of every invite/reinvite email, so the Invites and Accounts tabs
-- can show when someone was last contacted. Without it two officers working
-- the same list have no way to tell who has already been emailed, and the
-- people we are trying to win back get mailed twice.
--
-- Keyed by email rather than by user id on purpose: half these recipients
-- have no account at all (they came off an event sign-in sheet), so an email
-- address is the only identifier both groups share.
--
-- No RLS policies, matching public.otp_codes: RLS on with zero policies is
-- deny-all for anon and authenticated, and the server actions that read and
-- write this go through the service-role client after checking manage_accounts.

create table if not exists public.invite_sends (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  kind text not null check (kind in ('reinvite', 'attendance_invite')),
  sent_at timestamptz not null default now(),
  sent_by uuid references public.users (id) on delete set null
);

create index if not exists invite_sends_email_idx
  on public.invite_sends (lower(email), sent_at desc);

alter table public.invite_sends enable row level security;
