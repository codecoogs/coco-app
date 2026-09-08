-- RLS for the forms feature.
-- current_user_has_permission() and current_public_user_id() already exist
-- (20260406120000_role_permissions_user_profile.sql / 20260426124000_...sql).

-- True if the caller (auth.uid()) is allowed to see the given form based on its
-- audience_type: everyone (any authenticated member), roles (caller holds a
-- position whose role is in form_audience_roles), or positions (caller holds a
-- position in form_audience_positions). Does not consider status/is_active —
-- callers combine this with `status = 'published' and is_active` for respondents.
create or replace function public.current_user_can_view_form(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.forms f
    where f.id = p_form_id
      and (
        f.audience_type = 'everyone'
        or (
          f.audience_type = 'roles'
          and exists (
            select 1
            from public.users u
            join public.user_positions up on up.user_id = u.id and up.is_active is true
            join public.positions pos on pos.title = up."positionTitle"
            join public.form_audience_roles far on far.form_id = f.id and far.role_id = pos.role_id
            where u.auth_id = auth.uid()
          )
        )
        or (
          f.audience_type = 'positions'
          and exists (
            select 1
            from public.users u
            join public.user_positions up on up.user_id = u.id and up.is_active is true
            join public.positions pos on pos.title = up."positionTitle"
            join public.form_audience_positions fap on fap.form_id = f.id and fap.position_id = pos.id
            where u.auth_id = auth.uid()
          )
        )
      )
  );
$$;

comment on function public.current_user_can_view_form(uuid) is
  'RLS helper: true if auth.uid() is in the audience for this form (everyone/roles/positions). Combine with status/is_active checks.';

revoke all on function public.current_user_can_view_form(uuid) from public;
grant execute on function public.current_user_can_view_form(uuid) to authenticated, service_role;

-- forms ----------------------------------------------------------------

alter table public.forms enable row level security;

drop policy if exists forms_select_manage on public.forms;
create policy forms_select_manage
  on public.forms
  for select
  to authenticated
  using (public.current_user_has_permission('manage_forms'));

drop policy if exists forms_select_audience on public.forms;
create policy forms_select_audience
  on public.forms
  for select
  to authenticated
  using (
    is_active is true
    and status = 'published'
    and public.current_user_can_view_form(id)
  );

drop policy if exists forms_insert_manage on public.forms;
create policy forms_insert_manage
  on public.forms
  for insert
  to authenticated
  with check (
    public.current_user_has_permission('manage_forms')
    and created_by = public.current_public_user_id()
  );

drop policy if exists forms_update_manage on public.forms;
create policy forms_update_manage
  on public.forms
  for update
  to authenticated
  using (public.current_user_has_permission('manage_forms'))
  with check (public.current_user_has_permission('manage_forms'));

drop policy if exists forms_delete_manage on public.forms;
create policy forms_delete_manage
  on public.forms
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_forms'));

grant select, insert, update, delete on public.forms to authenticated;
grant select, insert, update, delete on public.forms to service_role;

-- form_questions ---------------------------------------------------------

alter table public.form_questions enable row level security;

drop policy if exists form_questions_select on public.form_questions;
create policy form_questions_select
  on public.form_questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.forms f
      where f.id = form_questions.form_id
        and (
          public.current_user_has_permission('manage_forms')
          or (
            f.is_active is true
            and f.status = 'published'
            and public.current_user_can_view_form(f.id)
          )
        )
    )
  );

drop policy if exists form_questions_insert_manage on public.form_questions;
create policy form_questions_insert_manage
  on public.form_questions
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_forms'));

drop policy if exists form_questions_update_manage on public.form_questions;
create policy form_questions_update_manage
  on public.form_questions
  for update
  to authenticated
  using (public.current_user_has_permission('manage_forms'))
  with check (public.current_user_has_permission('manage_forms'));

drop policy if exists form_questions_delete_manage on public.form_questions;
create policy form_questions_delete_manage
  on public.form_questions
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_forms'));

grant select, insert, update, delete on public.form_questions to authenticated;
grant select, insert, update, delete on public.form_questions to service_role;

-- form_question_options ---------------------------------------------------

alter table public.form_question_options enable row level security;

drop policy if exists form_question_options_select on public.form_question_options;
create policy form_question_options_select
  on public.form_question_options
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.form_questions q
      join public.forms f on f.id = q.form_id
      where q.id = form_question_options.question_id
        and (
          public.current_user_has_permission('manage_forms')
          or (
            f.is_active is true
            and f.status = 'published'
            and public.current_user_can_view_form(f.id)
          )
        )
    )
  );

drop policy if exists form_question_options_insert_manage on public.form_question_options;
create policy form_question_options_insert_manage
  on public.form_question_options
  for insert
  to authenticated
  with check (public.current_user_has_permission('manage_forms'));

drop policy if exists form_question_options_update_manage on public.form_question_options;
create policy form_question_options_update_manage
  on public.form_question_options
  for update
  to authenticated
  using (public.current_user_has_permission('manage_forms'))
  with check (public.current_user_has_permission('manage_forms'));

drop policy if exists form_question_options_delete_manage on public.form_question_options;
create policy form_question_options_delete_manage
  on public.form_question_options
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_forms'));

grant select, insert, update, delete on public.form_question_options to authenticated;
grant select, insert, update, delete on public.form_question_options to service_role;

-- form_audience_roles / form_audience_positions ---------------------------
-- Only the builder needs to read/write these directly; current_user_can_view_form()
-- runs as SECURITY DEFINER so respondents never need direct access.

alter table public.form_audience_roles enable row level security;

drop policy if exists form_audience_roles_manage on public.form_audience_roles;
create policy form_audience_roles_manage
  on public.form_audience_roles
  for all
  to authenticated
  using (public.current_user_has_permission('manage_forms'))
  with check (public.current_user_has_permission('manage_forms'));

grant select, insert, update, delete on public.form_audience_roles to authenticated;
grant select, insert, update, delete on public.form_audience_roles to service_role;

alter table public.form_audience_positions enable row level security;

drop policy if exists form_audience_positions_manage on public.form_audience_positions;
create policy form_audience_positions_manage
  on public.form_audience_positions
  for all
  to authenticated
  using (public.current_user_has_permission('manage_forms'))
  with check (public.current_user_has_permission('manage_forms'));

grant select, insert, update, delete on public.form_audience_positions to authenticated;
grant select, insert, update, delete on public.form_audience_positions to service_role;

-- form_responses -----------------------------------------------------------

alter table public.form_responses enable row level security;

drop policy if exists form_responses_select_own on public.form_responses;
create policy form_responses_select_own
  on public.form_responses
  for select
  to authenticated
  using (respondent_id = public.current_public_user_id());

drop policy if exists form_responses_select_manage on public.form_responses;
create policy form_responses_select_manage
  on public.form_responses
  for select
  to authenticated
  using (public.current_user_has_permission('manage_forms'));

-- Respondents may submit only for themselves, to a form that is currently open.
drop policy if exists form_responses_insert_own on public.form_responses;
create policy form_responses_insert_own
  on public.form_responses
  for insert
  to authenticated
  with check (
    respondent_id = public.current_public_user_id()
    and exists (
      select 1
      from public.forms f
      where f.id = form_responses.form_id
        and f.is_active is true
        and f.status = 'published'
        and public.current_user_can_view_form(f.id)
    )
  );

-- Respondents may edit their own response while the form is still open (not closed).
drop policy if exists form_responses_update_own on public.form_responses;
create policy form_responses_update_own
  on public.form_responses
  for update
  to authenticated
  using (
    respondent_id = public.current_public_user_id()
    and exists (
      select 1
      from public.forms f
      where f.id = form_responses.form_id
        and f.status = 'published'
    )
  )
  with check (respondent_id = public.current_public_user_id());

drop policy if exists form_responses_delete_manage on public.form_responses;
create policy form_responses_delete_manage
  on public.form_responses
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_forms'));

grant select, insert, update, delete on public.form_responses to authenticated;
grant select, insert, update, delete on public.form_responses to service_role;

-- form_response_answers ------------------------------------------------------

alter table public.form_response_answers enable row level security;

drop policy if exists form_response_answers_select_own on public.form_response_answers;
create policy form_response_answers_select_own
  on public.form_response_answers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.form_responses r
      where r.id = form_response_answers.response_id
        and r.respondent_id = public.current_public_user_id()
    )
  );

drop policy if exists form_response_answers_select_manage on public.form_response_answers;
create policy form_response_answers_select_manage
  on public.form_response_answers
  for select
  to authenticated
  using (public.current_user_has_permission('manage_forms'));

drop policy if exists form_response_answers_insert_own on public.form_response_answers;
create policy form_response_answers_insert_own
  on public.form_response_answers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.form_responses r
      join public.forms f on f.id = r.form_id
      where r.id = form_response_answers.response_id
        and r.respondent_id = public.current_public_user_id()
        and f.status = 'published'
    )
  );

drop policy if exists form_response_answers_update_own on public.form_response_answers;
create policy form_response_answers_update_own
  on public.form_response_answers
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.form_responses r
      join public.forms f on f.id = r.form_id
      where r.id = form_response_answers.response_id
        and r.respondent_id = public.current_public_user_id()
        and f.status = 'published'
    )
  )
  with check (
    exists (
      select 1
      from public.form_responses r
      where r.id = form_response_answers.response_id
        and r.respondent_id = public.current_public_user_id()
    )
  );

drop policy if exists form_response_answers_delete_own on public.form_response_answers;
create policy form_response_answers_delete_own
  on public.form_response_answers
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.form_responses r
      join public.forms f on f.id = r.form_id
      where r.id = form_response_answers.response_id
        and r.respondent_id = public.current_public_user_id()
        and f.status = 'published'
    )
  );

drop policy if exists form_response_answers_delete_manage on public.form_response_answers;
create policy form_response_answers_delete_manage
  on public.form_response_answers
  for delete
  to authenticated
  using (public.current_user_has_permission('manage_forms'));

grant select, insert, update, delete on public.form_response_answers to authenticated;
grant select, insert, update, delete on public.form_response_answers to service_role;
