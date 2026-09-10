# Environments (local, dev, production)

How the three environments fit together, and the traps that are easy to fall into.
Written 2026-09-06, when the dev environment was first set up.

## The three environments

| | Database | App | Who it is for |
| --- | --- | --- | --- |
| **Local** | Docker (`supabase start`) | `npm run dev` on `localhost:3000` | your machine, free, destroy it whenever |
| **Dev** | Supabase persistent branch `dev` (`plkogchblccmresvdsvm`) | `coco-app-git-dev-coco-wizards-projects.vercel.app` | shared testing after a PR merges |
| **Production** | Supabase project `gogo` (`hbhahqephsndzjtqdzin`) | `app.codecoogs.com` | real members |

The Vercel team is `coco-wizards-projects` and the project is `coco-app`.

### The flow

```
feature branch --PR--> dev --------> main
                        |              |
                   Supabase dev    production
                   + dev site      + app.codecoogs.com
```

Push or merge into `dev` and Supabase runs its deployment workflow against the
dev branch database: clone the repo, apply the config, run any new migrations,
run the seed, deploy edge functions. Vercel rebuilds the dev site at the same
time. Merging `dev` into `main` does the same thing against production.

The dev site's URL never changes. Vercel gives every git branch a permanent
alias of the form `<project>-git-<branch>-<team>.vercel.app`, always serving that
branch's latest deployment. Vercel has no "persistent branch" setting; the stable
alias is the whole mechanism.

### Why a Supabase branch rather than a second project

A second Supabase project would cost the same (~$9.81/month — that is just the
price of a second Micro compute instance, since a paid plan's $10 credit only
covers one). The branch additionally applies migrations, config and edge
functions automatically on every push, and lives in the same region as
production.

There is a leftover paused project named `gogo-dev` (`vvidqmcwtkgkrkfvbinm`) from
an earlier attempt. It is not used. Paused, it costs nothing.

## Migrations: one baseline, not a history

`supabase/migrations/` holds a single file, `20260101000000_baseline.sql`, dumped
from production. The 72 migrations that came before it are in
`supabase/migrations_archive/` — kept for reading, never applied. Git recorded
them as renames, so `git log --follow` still works on each one.

They were squashed because they could not rebuild the schema from scratch, which
meant no new Supabase branch could ever be created. Two independent causes:

1. **Ordering.** `20260204180000` and `20260204200000` referenced `public.users`,
   but the dump that creates it (`20260218055313`) sorts after them. Production
   never noticed: all three were recorded as applied before the dump existed, so
   they never replay there.
2. **Drift.** Production had been edited through the dashboard and those edits
   were never captured. `events` carried nine columns no migration adds and
   lacked `points_awarded` which one does add. `deleted_users` and
   `unassigned_attendance` existed in production but were created by no migration
   at all — while `20260426130000` writes RLS policies against the latter.

The archive directory sits outside `supabase/migrations/` deliberately. The CLI
hardcodes that path (`[db.migrations]` only exposes `enabled` and `schema_paths`,
and `schema_paths` is for declarative schemas, which this project does not use),
so nothing in the archive can be picked up by accident.

### Regenerating the baseline — read this first

`supabase db dump --linked --schema public` produces only section 1 of the file.
Sections 2 to 5 are appended by hand and **a regeneration will silently drop
them**:

| Section | Contents | What breaks without it |
| --- | --- | --- |
| 2 | the sentinel user `00000000-0000-0000-0000-000000000001` | forty columns across twenty tables `DEFAULT` to it with an FK to `public.users(id)`, so a fresh database rejects almost every insert — including ones the app makes |
| 3 | `on_auth_user_created` trigger on `auth.users` | the dump ships `handle_new_user_link()` but not the trigger, so signup never creates a `public.users` row, with no error |
| 4 | 5 storage buckets | uploads fail, no buckets exist |
| 5 | 14 `storage.objects` RLS policies | avatars, flyers and form uploads are all denied |

Section 5 also needs `SET search_path = public` before it: the dump sets
`search_path = ''` near the top, and those policies reference `form_responses`
and `current_public_user_id()` unqualified. Postgres resolves and stores the OIDs
at `CREATE POLICY` time, so it only matters at creation.

The sentinel user is data living in a schema file. That is deliberate — a branch
may run with seeding disabled, and the schema does not function without the row.

### Adding a migration

Create it with `supabase migration new <name>` — never invent the filename.
Verify it applies from scratch with `supabase db reset` before pushing, because
that is exactly what a branch deploy will do.

## config.toml is a production input

The deployment workflow's **Configure** step applies `config.toml` on top of a
target's existing configuration. Anything in the root blocks reaches production
on the next merge to `main` unless a `[remotes.production]` entry pins it.

Two blocks guard this:

- `[remotes.production]` (`project_id = "hbhahqephsndzjtqdzin"`) pins the real
  `site_url`, redirect allowlist, MFA TOTP settings, email frequency and session
  timebox. Without it, a merge would point production's auth at
  `localhost:3000`, empty the redirect allowlist and disable MFA.
- `[remotes.dev]` (`project_id = "plkogchblccmresvdsvm"`) pins the dev site's
  auth URLs and enables seeding. Persistent branches do not seed automatically
  the way preview branches do, so it has to be declared per-remote.

This has already bitten once. The first merge to `main` removed `storage` from
production's exposed Data API schemas, because `[remotes.production]` pinned only
auth while the root `[api]` block still held the CLI default. Nothing broke — the
app reaches storage through `supabase.storage.*`, which is the Storage API rather
than PostgREST — but production's API surface changed without anyone asking for
it.

**Before merging anything that touches `config.toml`, check whether production
disagrees with the new value, and pin it if so.**

`[remotes.production.auth.rate_limit] email_sent = 400` was added on 2026-09-10
for exactly this reason. Production had been raised to 400 emails/hour through
the dashboard while the root block still held the CLI default of `2`. It had
survived every merge so far only because the setting is conditional on custom
SMTP — the stock comment reads "Requires auth.email.smtp to be enabled", and no
environment enables it — so the value was being skipped rather than applied.
Turning SMTP on anywhere would have made the root default live and cut
production to 2/hour. Checked at the same time: every other limit in the root
block (`sms_sent`, `token_refresh`, `token_verifications`, `anonymous_users`,
`sign_in_sign_ups`, `web3`) already matches production, so `email_sent` is the
only one that needs a pin.

`[remotes.production.auth] site_url` was also `http://app.codecoogs.com/dashboard`
until 2026-09-10 — plain http on a production domain — and is now https.

## Vercel environment variables

Vercel has two environments: Production (`main`) and Preview (everything else).
Within Preview, a variable can be scoped to a single git branch, and that
overrides the wider Preview value.

The dev branch has four branch-scoped variables pointing at the dev Supabase
branch: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL`.

```bash
vercel env ls preview dev
```

```bash
vercel env add NAME preview dev
```

Two things to know:

- **`vercel env rm NAME preview` deletes the whole record**, not just the preview
  target. If the record also targets Production — as the Supabase variables do —
  production's value goes with it. Change environment targets in the dashboard,
  where they are checkboxes, not through the CLI.
- **`NEXT_PUBLIC_` variables that look like credentials need an explicit
  `--type config`**, otherwise the CLI refuses and asks you to choose. The anon
  key is public by design (it ships in the browser bundle), so `config` is
  correct for it.

The Supabase Vercel integration is not used to sync these. Its synchronisation
fires when a pull request is opened, and `dev` has no PR open against it, so
nothing would ever trigger a sync.

## Which branches deploy

Only `main` and `dev`. Every other branch used to build a preview that read the
Preview-scoped variables — which hold production credentials, including the
service-role key that bypasses RLS. Testing happens by merging into `dev`, so
those builds served no purpose.

Two mechanisms, deliberately overlapping:

- `vercel.json` sets `git.deploymentEnabled` to
  `{"**": false, "main": true, "dev": true}`. A branch matching several rules
  deploys if any rule is true, so `main` and `dev` still build. `**` rather than
  `*` because minimatch does not cross the slash in `feature/*`. This is read
  from the deployed commit, so it does not apply to branches created before it
  was added.
- An **Ignored Build Step** in project settings covers those older branches,
  since Vercel evaluates it per deployment regardless of the branch's contents.
  The convention is inverted — exit `1` to build, exit `0` to skip:

  ```bash
  if [ "$VERCEL_GIT_COMMIT_REF" = "main" ] || [ "$VERCEL_GIT_COMMIT_REF" = "dev" ]; then exit 1; else exit 0; fi
  ```

## Common tasks

Local database from scratch (applies the baseline, then `seed.sql`):

```bash
supabase start
```

```bash
supabase db reset
```

Branch status, and branch credentials (this one prints secrets):

```bash
supabase branches list --project-ref hbhahqephsndzjtqdzin --experimental
```

```bash
supabase branches get dev --project-ref hbhahqephsndzjtqdzin --experimental
```

Query a specific environment — local, dev branch, production:

```bash
supabase db query "select 1;"
```

```bash
supabase db query --linked --project-ref plkogchblccmresvdsvm "select 1;"
```

```bash
supabase db query --linked "select 1;"
```

Note `db query` splits on newlines — keep a query on one line.

### Getting a working login on dev

The seed cannot create one; a real login needs a GoTrue `auth.users` and
`auth.identities` pair. Sign up through the dev site, then read the OTP straight
out of the branch database instead of waiting for email:

```bash
supabase db query --linked --project-ref plkogchblccmresvdsvm "select o.code from public.otp_codes o join auth.users u on u.id = o.auth_id where u.email = 'you@example.com' order by o.created_at desc limit 1;"
```

Then make the account an admin. `is_admin` short-circuits every permission check,
and the dev branch is persistent, so this survives every later deploy:

```bash
supabase db query --linked --project-ref plkogchblccmresvdsvm "insert into public.user_positions (user_id, \"positionTitle\", is_active) values ((select id from public.users where email = 'you@example.com'), 'QA Officer', true);"
```

The `QA Officer` position comes from `supabase/seed.sql`, which also creates two
forms, eleven opportunities covering every category, and an academic year →
semester → membership plan chain with dates relative to the current date. It is
idempotent — fixed ids with `ON CONFLICT DO UPDATE` — so it re-runs safely on
every dev deploy.

Branch databases never start with production data. Copying it would need the PITR
add-on and would put real member PII on a test database.

## Troubleshooting

**`Remote migration versions not found in local migrations directory`** — the
target's history table lists versions the repo no longer has. The deploy stops
before touching the database, which is the desired behaviour. Fix the history
rather than the files:

```bash
supabase migration repair --linked --status reverted <old versions...>
```

```bash
supabase migration repair --linked --status applied <the version that is really there>
```

```bash
supabase migration list --linked
```

The last one should show local and remote matching. Repair writes only to
`supabase_migrations.schema_migrations` — no schema, no data.

**A migration fails on a branch but production is fine** — production's history
almost certainly records it as already applied, so it never replays there. Prove
it locally with `supabase db reset`; that is the same from-scratch replay a
branch performs, and it is much faster to iterate on.

**The Supabase CLI exits 0 even when it failed.** Check the output for
`"_tag":"Error"` rather than trusting the exit code. A missing Docker daemon
looks like success this way.

**Checking parity between two environments** — count objects on both and compare:

```sql
select 'tables' as k, count(*)::text as v from information_schema.tables where table_schema='public' and table_type='BASE TABLE' union all select 'columns', count(*)::text from information_schema.columns where table_schema='public' union all select 'policies', count(*)::text from pg_policies where schemaname='public' union all select 'storage_policies', count(*)::text from pg_policies where schemaname='storage' union all select 'buckets', count(*)::text from storage.buckets union all select 'functions', count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' union all select 'auth_triggers', count(*)::text from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and not t.tgisinternal;
```

At the time of writing all three environments report 48 tables, 497 columns, 198
public policies, 14 storage policies, 5 buckets, 43 functions and 1 auth trigger.

## Costs

The dev branch runs a Micro compute instance at $0.01344/hour, about $9.81 a
month, billed to the Code[Coogs] organisation. A paid plan includes $10 of
compute credit, which production already consumes. Deleting the branch stops the
charge; the credentials change if it is ever recreated, so `[remotes.dev]` and
the Vercel branch-scoped variables would need updating.
