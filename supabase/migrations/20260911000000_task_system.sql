-- Task system: one board per branch, orderable columns, and tasks that can
-- carry several assignees, a checklist, comments, and an activity trail.
--
-- The point of this migration is that the chain of command lives in the
-- database, not in the UI. positions.parent_position_id turns the org chart
-- into a tree; current_user_can_assign_to() walks that tree so a VP can hand
-- work to their directors and officers, a director to their officers, and
-- anyone to themselves. Visibility is per board: if you can see the board you
-- can see every task on it, which is what makes it a shared board rather than
-- a pile of private lists.
--
-- Note on triggers: public.handle_updated_at() also stamps updated_by with
-- auth.uid(), but every audit column here references public.users(id), which
-- is a different id. So these tables use update_updated_at_column() and the
-- server actions set updated_by themselves.

-- ---------------------------------------------------------------------------
-- 1. Reporting hierarchy on positions
-- ---------------------------------------------------------------------------

alter table public.positions
  add column if not exists parent_position_id bigint;

alter table public.positions
  drop constraint if exists positions_parent_position_id_fkey;

alter table public.positions
  add constraint positions_parent_position_id_fkey
  foreign key (parent_position_id) references public.positions(id) on delete set null;

alter table public.positions
  drop constraint if exists positions_parent_position_id_not_self;

alter table public.positions
  add constraint positions_parent_position_id_not_self
  check (parent_position_id is null or parent_position_id <> id);

create index if not exists positions_parent_position_id_idx
  on public.positions (parent_position_id);

comment on column public.positions.parent_position_id is
  'The position this one reports to. Drives task assignment rules and the org chart canvas.';

-- ---------------------------------------------------------------------------
-- 2. Hierarchy helpers
--
-- All of these are SECURITY DEFINER because they read user_positions and
-- positions, which the calling user may not be able to select directly.
-- user_positions links to positions by title text, not id, so every join here
-- matches p.title = up."positionTitle" the way the existing helpers do.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_position_ids()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.users u
  join public.user_positions up on up.user_id = u.id and up.is_active is true
  join public.positions p on p.title = up."positionTitle"
  where u.auth_id = auth.uid();
$$;

create or replace function public.current_user_is_admin_position()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.positions p
    where p.id in (select public.current_user_position_ids())
      and p.is_admin is true
  );
$$;

-- UNION (not UNION ALL) so a cycle in the chart cannot spin forever.
create or replace function public.position_descendant_ids(p_position_id bigint)
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select id from public.positions where id = p_position_id
    union
    select c.id
    from public.positions c
    join tree t on c.parent_position_id = t.id
  )
  select id from tree;
$$;

-- Every position at or below the ones the current user holds.
create or replace function public.current_user_scope_position_ids()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.current_user_position_ids() as mine(id)
  cross join lateral public.position_descendant_ids(mine.id) as d(id);
$$;

-- Yourself, anyone below you in the chart, or anything at all if you hold an
-- admin position (President, VP Internal, Software Director today).
create or replace function public.current_user_can_assign_to(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id is not null
    and (
      p_user_id = public.current_public_user_id()
      or public.current_user_is_admin_position()
      or exists (
        select 1
        from public.user_positions up
        join public.positions p on p.title = up."positionTitle"
        where up.user_id = p_user_id
          and up.is_active is true
          and p.id in (select public.current_user_scope_position_ids())
      )
    );
$$;

-- Someone with at least one position reporting to them: a director, a VP, the
-- President. Used to gate creating and renaming boards.
create or replace function public.current_user_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_is_admin_position()
    or exists (
      select 1
      from public.positions c
      where c.parent_position_id in (select public.current_user_position_ids())
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.task_boards (
  id uuid primary key default gen_random_uuid(),
  branch_id bigint references public.branches(id) on delete set null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default '00000000-0000-0000-0000-000000000001'::uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create unique index if not exists task_boards_active_branch_key
  on public.task_boards (branch_id)
  where branch_id is not null and is_active;

create table if not exists public.task_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.task_boards(id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  is_done_column boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default '00000000-0000-0000-0000-000000000001'::uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create index if not exists task_columns_board_order_idx
  on public.task_columns (board_id, order_index);

create unique index if not exists task_columns_board_name_key
  on public.task_columns (board_id, lower(name));

-- Lets task_items point at (column_id, board_id) together, so a task can never
-- sit in a column that belongs to a different board.
alter table public.task_columns
  drop constraint if exists task_columns_id_board_id_key;

alter table public.task_columns
  add constraint task_columns_id_board_id_key unique (id, board_id);

create table if not exists public.task_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.task_boards(id) on delete cascade,
  column_id uuid not null,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  -- Fractional rank: dropping a card between two others averages its
  -- neighbours instead of renumbering the whole column, which matters when
  -- other people are watching the board over realtime.
  order_index double precision not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default '00000000-0000-0000-0000-000000000001'::uuid references public.users(id),
  updated_by uuid references public.users(id)
);

alter table public.task_items
  drop constraint if exists task_items_column_board_fkey;

alter table public.task_items
  add constraint task_items_column_board_fkey
  foreign key (column_id, board_id)
  references public.task_columns(id, board_id) on delete restrict;

create index if not exists task_items_column_order_idx
  on public.task_items (column_id, order_index);

create index if not exists task_items_board_idx
  on public.task_items (board_id);

create index if not exists task_items_due_open_idx
  on public.task_items (due_at)
  where completed_at is null;

create table if not exists public.task_assignees (
  task_id uuid not null references public.task_items(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assigned_by uuid references public.users(id),
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists task_assignees_user_idx
  on public.task_assignees (user_id);

create table if not exists public.task_labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.task_boards(id) on delete cascade,
  name text not null,
  color text not null default 'slate',
  created_at timestamptz not null default now(),
  created_by uuid not null default '00000000-0000-0000-0000-000000000001'::uuid references public.users(id)
);

create unique index if not exists task_labels_board_name_key
  on public.task_labels (board_id, lower(name));

create table if not exists public.task_item_labels (
  task_id uuid not null references public.task_items(id) on delete cascade,
  label_id uuid not null references public.task_labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_items(id) on delete cascade,
  content text not null,
  is_done boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default '00000000-0000-0000-0000-000000000001'::uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create index if not exists task_checklist_task_order_idx
  on public.task_checklist_items (task_id, order_index);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_items(id) on delete cascade,
  author_id uuid not null references public.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_comments_task_created_idx
  on public.task_comments (task_id, created_at desc);

create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_items(id) on delete cascade,
  actor_id uuid references public.users(id),
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists task_activity_task_created_idx
  on public.task_activity (task_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists task_boards_set_updated_at on public.task_boards;
create trigger task_boards_set_updated_at before update on public.task_boards
  for each row execute function public.update_updated_at_column();

drop trigger if exists task_columns_set_updated_at on public.task_columns;
create trigger task_columns_set_updated_at before update on public.task_columns
  for each row execute function public.update_updated_at_column();

drop trigger if exists task_items_set_updated_at on public.task_items;
create trigger task_items_set_updated_at before update on public.task_items
  for each row execute function public.update_updated_at_column();

drop trigger if exists task_checklist_items_set_updated_at on public.task_checklist_items;
create trigger task_checklist_items_set_updated_at before update on public.task_checklist_items
  for each row execute function public.update_updated_at_column();

drop trigger if exists task_comments_set_updated_at on public.task_comments;
create trigger task_comments_set_updated_at before update on public.task_comments
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. Board visibility and task edit helpers
-- ---------------------------------------------------------------------------

-- You can see a branch's board if you hold a position in that branch, or if
-- anyone in that branch reports up to you (this is how the President sees
-- everything). A board with no branch is org-wide.
create or replace function public.current_user_can_view_board(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_boards b
    where b.id = p_board_id
      and (
        public.current_user_is_admin_position()
        or b.branch_id is null
        or exists (
          select 1
          from public.positions p
          where p.id in (select public.current_user_scope_position_ids())
            and p.branch_id = b.branch_id
        )
      )
  );
$$;

-- Edit rights on a single task: the person who made it, anyone it is assigned
-- to, anyone above one of those people, and admins.
create or replace function public.current_user_can_edit_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_items t
    where t.id = p_task_id
      and (
        public.current_user_is_admin_position()
        or t.created_by = public.current_public_user_id()
        or public.current_user_can_assign_to(t.created_by)
        or exists (
          select 1
          from public.task_assignees ta
          where ta.task_id = t.id
            and (
              ta.user_id = public.current_public_user_id()
              or public.current_user_can_assign_to(ta.user_id)
            )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. Row level security
-- ---------------------------------------------------------------------------

alter table public.task_boards enable row level security;
alter table public.task_columns enable row level security;
alter table public.task_items enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_item_labels enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;

-- Boards: everyone with view_tasks sees the boards they belong to; only
-- managers (someone reports to them) create, rename, or archive one.
drop policy if exists task_boards_select on public.task_boards;
create policy task_boards_select on public.task_boards for select to authenticated
  using (public.current_user_has_permission('view_tasks') and public.current_user_can_view_board(id));

drop policy if exists task_boards_insert_manager on public.task_boards;
create policy task_boards_insert_manager on public.task_boards for insert to authenticated
  with check (public.current_user_has_permission('manage_tasks') and public.current_user_is_manager());

drop policy if exists task_boards_update_manager on public.task_boards;
create policy task_boards_update_manager on public.task_boards for update to authenticated
  using (public.current_user_has_permission('manage_tasks') and public.current_user_is_manager() and public.current_user_can_view_board(id))
  with check (public.current_user_has_permission('manage_tasks') and public.current_user_is_manager());

drop policy if exists task_boards_delete_admin on public.task_boards;
create policy task_boards_delete_admin on public.task_boards for delete to authenticated
  using (public.current_user_is_admin_position());

-- Columns: any officer on the board can add or reorder them, which is the
-- "add a Backlog column" case.
drop policy if exists task_columns_select on public.task_columns;
create policy task_columns_select on public.task_columns for select to authenticated
  using (public.current_user_has_permission('view_tasks') and public.current_user_can_view_board(board_id));

drop policy if exists task_columns_write on public.task_columns;
create policy task_columns_write on public.task_columns for all to authenticated
  using (public.current_user_has_permission('manage_tasks') and public.current_user_can_view_board(board_id))
  with check (public.current_user_has_permission('manage_tasks') and public.current_user_can_view_board(board_id));

-- Tasks: seen by the whole board, created by any officer on it, edited only
-- by the people current_user_can_edit_task() allows.
drop policy if exists task_items_select on public.task_items;
create policy task_items_select on public.task_items for select to authenticated
  using (public.current_user_has_permission('view_tasks') and public.current_user_can_view_board(board_id));

drop policy if exists task_items_insert on public.task_items;
create policy task_items_insert on public.task_items for insert to authenticated
  with check (
    public.current_user_has_permission('manage_tasks')
    and public.current_user_can_view_board(board_id)
    and created_by = public.current_public_user_id()
  );

drop policy if exists task_items_update on public.task_items;
create policy task_items_update on public.task_items for update to authenticated
  using (public.current_user_has_permission('manage_tasks') and public.current_user_can_edit_task(id))
  with check (public.current_user_has_permission('manage_tasks') and public.current_user_can_view_board(board_id));

drop policy if exists task_items_delete on public.task_items;
create policy task_items_delete on public.task_items for delete to authenticated
  using (public.current_user_has_permission('manage_tasks') and public.current_user_can_edit_task(id));

-- Assignees: this is where the hierarchy bites. You may only put someone on a
-- task if they are you, or they report to you somewhere down the chart.
drop policy if exists task_assignees_select on public.task_assignees;
create policy task_assignees_select on public.task_assignees for select to authenticated
  using (
    public.current_user_has_permission('view_tasks')
    and exists (
      select 1 from public.task_items t
      where t.id = task_assignees.task_id and public.current_user_can_view_board(t.board_id)
    )
  );

drop policy if exists task_assignees_insert on public.task_assignees;
create policy task_assignees_insert on public.task_assignees for insert to authenticated
  with check (
    public.current_user_has_permission('manage_tasks')
    and public.current_user_can_assign_to(user_id)
    and public.current_user_can_edit_task(task_id)
  );

drop policy if exists task_assignees_delete on public.task_assignees;
create policy task_assignees_delete on public.task_assignees for delete to authenticated
  using (
    public.current_user_has_permission('manage_tasks')
    and (user_id = public.current_public_user_id() or public.current_user_can_assign_to(user_id))
    and public.current_user_can_edit_task(task_id)
  );

-- Labels belong to a board.
drop policy if exists task_labels_select on public.task_labels;
create policy task_labels_select on public.task_labels for select to authenticated
  using (public.current_user_has_permission('view_tasks') and public.current_user_can_view_board(board_id));

drop policy if exists task_labels_write on public.task_labels;
create policy task_labels_write on public.task_labels for all to authenticated
  using (public.current_user_has_permission('manage_tasks') and public.current_user_can_view_board(board_id))
  with check (public.current_user_has_permission('manage_tasks') and public.current_user_can_view_board(board_id));

drop policy if exists task_item_labels_select on public.task_item_labels;
create policy task_item_labels_select on public.task_item_labels for select to authenticated
  using (
    public.current_user_has_permission('view_tasks')
    and exists (
      select 1 from public.task_items t
      where t.id = task_item_labels.task_id and public.current_user_can_view_board(t.board_id)
    )
  );

drop policy if exists task_item_labels_write on public.task_item_labels;
create policy task_item_labels_write on public.task_item_labels for all to authenticated
  using (public.current_user_has_permission('manage_tasks') and public.current_user_can_edit_task(task_id))
  with check (public.current_user_has_permission('manage_tasks') and public.current_user_can_edit_task(task_id));

-- Checklist items follow the task's edit rights.
drop policy if exists task_checklist_items_select on public.task_checklist_items;
create policy task_checklist_items_select on public.task_checklist_items for select to authenticated
  using (
    public.current_user_has_permission('view_tasks')
    and exists (
      select 1 from public.task_items t
      where t.id = task_checklist_items.task_id and public.current_user_can_view_board(t.board_id)
    )
  );

drop policy if exists task_checklist_items_write on public.task_checklist_items;
create policy task_checklist_items_write on public.task_checklist_items for all to authenticated
  using (public.current_user_has_permission('manage_tasks') and public.current_user_can_edit_task(task_id))
  with check (public.current_user_has_permission('manage_tasks') and public.current_user_can_edit_task(task_id));

-- Comments: anyone on the board may add one (that is how an officer asks for
-- help), but only the author may change or remove it.
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments for select to authenticated
  using (
    public.current_user_has_permission('view_tasks')
    and exists (
      select 1 from public.task_items t
      where t.id = task_comments.task_id and public.current_user_can_view_board(t.board_id)
    )
  );

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (
    public.current_user_has_permission('view_tasks')
    and author_id = public.current_public_user_id()
    and exists (
      select 1 from public.task_items t
      where t.id = task_comments.task_id and public.current_user_can_view_board(t.board_id)
    )
  );

drop policy if exists task_comments_update_own on public.task_comments;
create policy task_comments_update_own on public.task_comments for update to authenticated
  using (author_id = public.current_public_user_id())
  with check (author_id = public.current_public_user_id());

drop policy if exists task_comments_delete_own on public.task_comments;
create policy task_comments_delete_own on public.task_comments for delete to authenticated
  using (author_id = public.current_public_user_id() or public.current_user_is_admin_position());

-- Activity is an append-only trail: readable by the board, never edited.
drop policy if exists task_activity_select on public.task_activity;
create policy task_activity_select on public.task_activity for select to authenticated
  using (
    public.current_user_has_permission('view_tasks')
    and exists (
      select 1 from public.task_items t
      where t.id = task_activity.task_id and public.current_user_can_view_board(t.board_id)
    )
  );

drop policy if exists task_activity_insert on public.task_activity;
create policy task_activity_insert on public.task_activity for insert to authenticated
  with check (
    public.current_user_has_permission('view_tasks')
    and actor_id = public.current_public_user_id()
    and exists (
      select 1 from public.task_items t
      where t.id = task_activity.task_id and public.current_user_can_view_board(t.board_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------

grant select, insert, references, delete, trigger, truncate, update on table public.task_boards to anon, authenticated, service_role;
grant select, insert, references, delete, trigger, truncate, update on table public.task_columns to anon, authenticated, service_role;
grant select, insert, references, delete, trigger, truncate, update on table public.task_items to anon, authenticated, service_role;
grant select, insert, references, delete, trigger, truncate, update on table public.task_assignees to anon, authenticated, service_role;
grant select, insert, references, delete, trigger, truncate, update on table public.task_labels to anon, authenticated, service_role;
grant select, insert, references, delete, trigger, truncate, update on table public.task_item_labels to anon, authenticated, service_role;
grant select, insert, references, delete, trigger, truncate, update on table public.task_checklist_items to anon, authenticated, service_role;
grant select, insert, references, delete, trigger, truncate, update on table public.task_comments to anon, authenticated, service_role;
grant select, insert, references, delete, trigger, truncate, update on table public.task_activity to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Realtime
--
-- The board is a live page, so these tables are published. Default replica
-- identity is enough: deletes only need to carry the primary key.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['task_items', 'task_columns', 'task_assignees', 'task_comments', 'task_checklist_items']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 9. Seed the first version of the chart
--
-- Rule-based, and only ever fills blanks, so re-running it will not stomp on
-- edits made later from the org chart canvas:
--   VPs            -> President
--   Directors      -> the VP of their branch
--   everyone else  -> the Director in their branch whose first word matches
--                     (Marketing Officer -> Marketing Director), else their VP
-- ---------------------------------------------------------------------------

update public.positions p
set parent_position_id = pres.id
from public.positions pres
where pres.title = 'President'
  and p.parent_position_id is null
  and p.id <> pres.id
  and p.title ilike 'vice president%';

update public.positions p
set parent_position_id = vp.id
from public.positions vp
where p.parent_position_id is null
  and p.id <> vp.id
  and vp.title ilike 'vice president%'
  and vp.branch_id = p.branch_id
  and p.title ilike '%director%';

update public.positions p
set parent_position_id = d.id
from public.positions d
where p.parent_position_id is null
  and p.id <> d.id
  and d.title ilike '%director%'
  and d.branch_id = p.branch_id
  and left(lower(split_part(btrim(p.title), ' ', 1)), 4) = left(lower(split_part(btrim(d.title), ' ', 1)), 4)
  and p.title not ilike '%director%'
  and p.title not ilike 'vice president%'
  and btrim(p.title) <> 'President'
  and btrim(p.title) <> 'Admin';

update public.positions p
set parent_position_id = vp.id
from public.positions vp
where p.parent_position_id is null
  and p.id <> vp.id
  and vp.title ilike 'vice president%'
  and vp.branch_id = p.branch_id
  and btrim(p.title) <> 'President'
  and btrim(p.title) <> 'Admin';

-- ---------------------------------------------------------------------------
-- 10. Seed a board per active branch, with the usual three columns
-- ---------------------------------------------------------------------------

insert into public.task_boards (branch_id, name, description)
select b.id, b.name, 'Task board for the ' || b.name || ' branch.'
from public.branches b
where b.is_active is true
  and not exists (
    select 1 from public.task_boards tb where tb.branch_id = b.id and tb.is_active
  );

insert into public.task_columns (board_id, name, order_index, is_done_column)
select tb.id, c.name, c.order_index, c.is_done
from public.task_boards tb
cross join (values ('Backlog', 0, false), ('In Progress', 1, false), ('Done', 2, true)) as c(name, order_index, is_done)
where not exists (
  select 1 from public.task_columns tc where tc.board_id = tb.id and lower(tc.name) = lower(c.name)
);

-- ---------------------------------------------------------------------------
-- 11. Who may I assign to?
--
-- The picker in the task modal calls this rather than rebuilding the rule in
-- TypeScript, so the list can never disagree with the policy that enforces it.
-- ---------------------------------------------------------------------------

create or replace function public.assignable_users()
returns table (id uuid, first_name text, last_name text, email text, position_title text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id,
         u.first_name,
         u.last_name,
         u.email,
         string_agg(p.title, ', ' order by p.title) as position_title
  from public.users u
  join public.user_positions up on up.user_id = u.id and up.is_active is true
  join public.positions p on p.title = up."positionTitle"
  where u.deleted_at is null
    and public.current_user_can_assign_to(u.id)
  group by u.id, u.first_name, u.last_name, u.email
  order by u.first_name nulls last, u.last_name nulls last;
$$;

comment on function public.assignable_users() is
  'Officers the signed-in user may put on a task: themselves and anyone below them in the position tree.';

grant execute on function public.assignable_users() to authenticated, service_role;
