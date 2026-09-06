-- Forms feature: admin-built forms (officer/exec applications, team sign-ups, etc.)
-- with ordered typed questions and member responses. Surveys are a separate,
-- future effort and are not part of this schema.

create table if not exists public.forms (
  id uuid default gen_random_uuid() not null primary key,

  title text not null,
  description text,

  -- draft: builder-only, not visible to respondents.
  -- published: visible to its audience and accepting responses.
  -- closed: still visible/readable but no longer accepting new or edited responses.
  status text not null default 'draft',
  constraint forms_status_check check (status in ('draft', 'published', 'closed')),

  -- everyone: any authenticated member. roles/positions: restricted via the
  -- form_audience_roles / form_audience_positions join tables below.
  audience_type text not null default 'everyone',
  constraint forms_audience_type_check check (audience_type in ('everyone', 'roles', 'positions')),

  created_by uuid not null references public.users (id) on delete cascade,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists public.form_questions (
  id uuid default gen_random_uuid() not null primary key,
  form_id uuid not null references public.forms (id) on delete cascade,

  type text not null,
  constraint form_questions_type_check check (
    type in ('short_answer', 'paragraph', 'single_select', 'multi_select', 'dropdown', 'date', 'file_upload')
  ),

  label text not null,
  help_text text,
  is_required boolean not null default false,
  order_index integer not null default 0,

  -- Optional mapping to a public.users column used to prefill the respondent's answer.
  autofill_source text,
  constraint form_questions_autofill_source_check check (
    autofill_source is null or autofill_source in (
      'first_name', 'last_name', 'email', 'phone', 'classification', 'expected_graduation', 'major', 'discord'
    )
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists form_questions_form_id_idx on public.form_questions (form_id);

-- Choices for single_select / multi_select / dropdown questions.
create table if not exists public.form_question_options (
  id uuid default gen_random_uuid() not null primary key,
  question_id uuid not null references public.form_questions (id) on delete cascade,
  label text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists form_question_options_question_id_idx on public.form_question_options (question_id);

-- Audience restriction: only relevant when forms.audience_type <> 'everyone'.
create table if not exists public.form_audience_roles (
  id uuid default gen_random_uuid() not null primary key,
  form_id uuid not null references public.forms (id) on delete cascade,
  role_id bigint not null references public.roles (id) on delete cascade,
  constraint form_audience_roles_form_role_unique unique (form_id, role_id)
);

create index if not exists form_audience_roles_form_id_idx on public.form_audience_roles (form_id);

create table if not exists public.form_audience_positions (
  id uuid default gen_random_uuid() not null primary key,
  form_id uuid not null references public.forms (id) on delete cascade,
  position_id bigint not null references public.positions (id) on delete cascade,
  constraint form_audience_positions_form_position_unique unique (form_id, position_id)
);

create index if not exists form_audience_positions_form_id_idx on public.form_audience_positions (form_id);

-- One editable response per respondent per form (respondents may update until the form closes).
create table if not exists public.form_responses (
  id uuid default gen_random_uuid() not null primary key,
  form_id uuid not null references public.forms (id) on delete cascade,
  respondent_id uuid not null references public.users (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_responses_form_respondent_unique unique (form_id, respondent_id)
);

create index if not exists form_responses_form_id_idx on public.form_responses (form_id);
create index if not exists form_responses_respondent_id_idx on public.form_responses (respondent_id);

create table if not exists public.form_response_answers (
  id uuid default gen_random_uuid() not null primary key,
  response_id uuid not null references public.form_responses (id) on delete cascade,
  question_id uuid not null references public.form_questions (id) on delete cascade,

  -- short_answer/paragraph/date store free text here; single_select/dropdown store the chosen option's id (as text) here.
  value text,
  -- multi_select stores the chosen option ids here.
  selected_option_ids uuid[],
  -- file_upload stores the Storage object path (bucket form-uploads) here.
  file_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_response_answers_response_question_unique unique (response_id, question_id)
);

create index if not exists form_response_answers_response_id_idx on public.form_response_answers (response_id);
create index if not exists form_response_answers_question_id_idx on public.form_response_answers (question_id);

-- Keep updated_at current across the feature's mutable tables.
create or replace function public.forms_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists forms_set_updated_at_trg on public.forms;
create trigger forms_set_updated_at_trg
before update on public.forms
for each row
execute function public.forms_set_updated_at();

drop trigger if exists form_questions_set_updated_at_trg on public.form_questions;
create trigger form_questions_set_updated_at_trg
before update on public.form_questions
for each row
execute function public.forms_set_updated_at();

drop trigger if exists form_responses_set_updated_at_trg on public.form_responses;
create trigger form_responses_set_updated_at_trg
before update on public.form_responses
for each row
execute function public.forms_set_updated_at();

drop trigger if exists form_response_answers_set_updated_at_trg on public.form_response_answers;
create trigger form_response_answers_set_updated_at_trg
before update on public.form_response_answers
for each row
execute function public.forms_set_updated_at();
