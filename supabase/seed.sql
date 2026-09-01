-- ============================================================================
-- LOCAL-ONLY QA SEED DATA — never touches production.
-- ============================================================================
--
-- This is Supabase's dedicated seed file (wired up in supabase/config.toml
-- under [db.seed], sql_paths = ["./seed.sql"]). It is structurally distinct
-- from supabase/migrations/*.sql: `supabase db push` (what we run against
-- production) only ever reads the migrations directory — it does not know
-- this file exists. Only `supabase db reset` (full local rebuild) applies
-- it. DO NOT move or copy this content into supabase/migrations/ — that
-- would make it a real migration and it WOULD ship to production.
--
-- Populates the tables that are tedious to hand-craft every time you want to
-- QA a change: roles/positions (an is_admin QA officer, so every permission
-- check passes with no manual role_permissions/position_permissions setup),
-- forms (published + draft), opportunities (every category/employment type,
-- plus two linked-form "internal" ones), and a membership plan you can grant
-- to any test account in one INSERT.
--
-- Safe to re-run any number of times — every insert is keyed by a fixed id
-- (or unique natural key) with ON CONFLICT DO UPDATE, so re-applying just
-- refreshes the same rows rather than duplicating or erroring.
--
-- HOW TO APPLY LOCALLY
-- ---------------------
-- `supabase db reset` should pick this up automatically, but a pre-existing,
-- unrelated migration-history bug currently breaks `db reset` from a clean
-- slate. Until that's fixed, apply this file directly instead:
--
--   docker exec -i supabase_db_coco-app psql -U postgres -d postgres < supabase/seed.sql
--
-- HOW TO ATTACH A REAL TEST ACCOUNT
-- -----------------------------------
-- This file can't create a working login itself (that needs a real
-- auth.users + auth.identities pair from GoTrue, not a raw SQL insert). Sign
-- up for real instead — it takes seconds locally:
--
--   1. Sign up at http://localhost:<dev-port>/ with any email/password.
--   2. Grab the OTP straight from the DB instead of checking email:
--        docker exec -i supabase_db_coco-app psql -U postgres -d postgres -c \
--          "select o.code from public.otp_codes o join auth.users u on u.id = o.auth_id where u.email = '<the email you signed up with>' order by o.created_at desc limit 1;"
--   3. Enter that code on the verify screen.
--
-- Then, to make that account a QA Officer (bypasses every permission check):
--
--   insert into public.user_positions (user_id, "positionTitle", is_active)
--   values ((select id from public.users where email = '<your test email>'), 'QA Officer', true);
--
-- ...or to grant it an active membership instead (for testing the
-- member-only, non-staff path):
--
--   insert into public.memberships (user_id, plan_id, status, starts_at, ends_at)
--   values (
--     (select id from public.users where email = '<your test email>'),
--     '60000000-0000-0000-0000-000000000001',
--     'active', current_date, current_date + 180
--   );
--
-- ============================================================================

-- QA Officer role + position -------------------------------------------------
-- is_admin = true short-circuits current_user_has_permission() entirely, so
-- no role_permissions/position_permissions rows are needed for this to be
-- able to do anything in the app.

with ins_role as (
  insert into public.roles (name, description)
  values ('QA Officer', 'Local-only seed role for QA/dev — see supabase/seed.sql.')
  on conflict (name) do update set description = excluded.description
  returning id
)
insert into public.positions (title, description, role_id, is_admin)
select
  'QA Officer',
  'Local-only seed position — is_admin bypasses every permission check. See supabase/seed.sql.',
  ins_role.id,
  true
from ins_role
on conflict (title) do update set role_id = excluded.role_id, is_admin = true;

-- QA seed-data owner user -----------------------------------------------------
-- Owns the seeded forms/opportunities below (their created_by / forms'
-- required created_by FK). Deliberately has no auth_id — it's not meant to
-- log in, just to be a valid FK target for system-owned test data.

insert into public.users (id, first_name, last_name, email, classification, expected_graduation)
values (
  '10000000-0000-0000-0000-000000000001',
  'QA',
  'Seed Bot',
  'qa-seed-bot@local.test',
  'staff',
  '2099-05'
)
on conflict (id) do update set email = excluded.email;

-- Forms ------------------------------------------------------------------------

insert into public.forms (id, title, description, status, audience_type, created_by)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'QA Seed Form — Published',
    'Published, everyone-visible form for QA. Linked from the internal-form opportunity below.',
    'published',
    'everyone',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'QA Seed Form — Draft',
    'Draft form for QA — e.g. testing the "not published yet" warning in the opportunity linker.',
    'draft',
    'everyone',
    '10000000-0000-0000-0000-000000000001'
  )
on conflict (id) do update set title = excluded.title, status = excluded.status;

-- Opportunities ------------------------------------------------------------------
-- One row per category/employment-type, plus two linked-form ("internal")
-- ones — covers every pill color and the internal-first sort in one seed.

insert into public.opportunities
  (id, title, link_url, linked_form_id, category, employment_type, is_active, display_order, notify_members, source, created_by)
values
  ('30000000-0000-0000-0000-000000000001', 'QA: Internal (published form, no category)', null, '20000000-0000-0000-0000-000000000001', null, null, true, 0, false, 'manual', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', 'QA: Internal (draft form, Internship category)', null, '20000000-0000-0000-0000-000000000002', 'Internship', null, true, 0, false, 'manual', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003', 'QA: Internship', 'https://example.com/qa-internship', null, 'Internship', null, true, 1, false, 'manual', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000004', 'QA: Full-time', 'https://example.com/qa-full-time', null, null, 'Full-time', true, 2, false, 'manual', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000005', 'QA: Part-time', 'https://example.com/qa-part-time', null, null, 'Part-time', true, 3, false, 'manual', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000006', 'QA: Contract', 'https://example.com/qa-contract', null, null, 'Contract', true, 4, false, 'manual', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000007', 'QA: Club Role', 'https://example.com/qa-club-role', null, 'Club Role', null, true, 5, false, 'manual', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000008', 'QA: Project', 'https://example.com/qa-project', null, 'Project', null, true, 6, false, 'manual', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000009', 'QA: Sponsor', 'https://example.com/qa-sponsor', null, 'Sponsor', null, true, 7, false, 'manual', '10000000-0000-0000-0000-000000000001'),
  ('3000000a-0000-0000-0000-000000000001', 'QA: Job', 'https://example.com/qa-job', null, 'Job', null, true, 8, false, 'manual', '10000000-0000-0000-0000-000000000001'),
  ('3000000b-0000-0000-0000-000000000001', 'QA: Other', 'https://example.com/qa-other', null, 'Other', null, true, 9, false, 'manual', '10000000-0000-0000-0000-000000000001')
on conflict (id) do update set
  title = excluded.title,
  is_active = excluded.is_active,
  category = excluded.category,
  employment_type = excluded.employment_type,
  linked_form_id = excluded.linked_form_id;

-- Membership plan (academic year + semester + plan) -------------------------
-- Dates are relative to whenever this file runs, so "active" checks
-- (status = 'active' and ends_at >= today) always pass right after seeding.

with ins_year as (
  insert into public.academic_years (id, label, is_current, start_date, end_date)
  values (
    '40000000-0000-0000-0000-000000000001',
    'QA Seed Year',
    true,
    date_trunc('year', current_date)::date,
    (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date
  )
  on conflict (id) do update set label = excluded.label
  returning id
),
ins_semester as (
  insert into public.semesters (id, academic_year_id, label, term, start_date, end_date, is_current)
  select
    '50000000-0000-0000-0000-000000000001',
    ins_year.id,
    'QA Seed Semester',
    'fall',
    current_date - 30,
    current_date + 150,
    true
  from ins_year
  on conflict (id) do update set start_date = excluded.start_date, end_date = excluded.end_date
  returning id
)
insert into public.membership_plans (id, name, kind, stripe_price_id, amount_cents, is_active, semester_id)
select
  '60000000-0000-0000-0000-000000000001',
  'QA Seed Membership Plan',
  'semester',
  'price_qa_seed',
  100,
  true,
  ins_semester.id
from ins_semester
on conflict (id) do update set semester_id = excluded.semester_id, is_active = true;

select 'QA seed applied — QA Officer position, 2 forms, 11 opportunities, 1 membership plan (60000000-0000-0000-0000-000000000001) ready.' as status;
