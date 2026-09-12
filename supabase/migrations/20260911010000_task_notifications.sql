-- Two ways an officer hears about their work.
--
-- 1. notify_task_assigned(): the bell lights up the moment someone is put on
--    a task. Without this, a task handed out on Tuesday sits silent until the
--    Sunday digest, which is the only other signal.
-- 2. task_digest_sends: one row per officer per week, so a retried cron run
--    cannot mail the same person twice. Same idea as public.invite_sends:
--    RLS on with no policies, written only by the service role.

create or replace function public.notify_task_assigned(p_task_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  -- Only for an assignment that actually exists: the task_assignees policy has
  -- already decided whether this officer was allowed to make it, so this
  -- function cannot be used to push notifications at people on its own.
  if not exists (
    select 1 from public.task_assignees ta
    where ta.task_id = p_task_id and ta.user_id = p_user_id
  ) then
    return;
  end if;

  -- Assigning yourself something is not news.
  if p_user_id = public.current_public_user_id() then
    return;
  end if;

  select title into v_title from public.task_items where id = p_task_id;
  if v_title is null then
    return;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, 'task_assigned', 'New task assigned to you', v_title, '/dashboard/tasks');
end;
$$;

comment on function public.notify_task_assigned(uuid, uuid) is
  'Writes a bell notification for a task assignment that already exists. Safe to call after any successful insert into task_assignees.';

grant execute on function public.notify_task_assigned(uuid, uuid) to authenticated, service_role;

create table if not exists public.task_digest_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null,
  task_count integer not null default 0,
  sent_at timestamptz not null default now()
);

create unique index if not exists task_digest_sends_user_week_key
  on public.task_digest_sends (user_id, week_start);

alter table public.task_digest_sends enable row level security;

-- No policies on purpose: nobody reads or writes this as themselves. The
-- weekly cron uses the service role, which bypasses RLS.

grant select, insert, delete on table public.task_digest_sends to service_role;
