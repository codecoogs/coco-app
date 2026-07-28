-- File-upload question answers: private bucket, one folder per response id
-- (path: {response_id}/{filename}), so a respondent's own response scopes their uploads.

insert into storage.buckets (id, name, public)
values ('form-uploads', 'form-uploads', false)
on conflict (id) do update set public = excluded.public;

-- Owner (the response's respondent) may upload/read/replace/remove their own files.
drop policy if exists "form_uploads_insert_own_response" on storage.objects;
create policy "form_uploads_insert_own_response"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'form-uploads'
    and exists (
      select 1
      from public.form_responses r
      where r.id::text = split_part(name, '/', 1)
        and r.respondent_id = public.current_public_user_id()
    )
  );

drop policy if exists "form_uploads_select_own_response" on storage.objects;
create policy "form_uploads_select_own_response"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'form-uploads'
    and (
      exists (
        select 1
        from public.form_responses r
        where r.id::text = split_part(name, '/', 1)
          and r.respondent_id = public.current_public_user_id()
      )
      or public.current_user_has_permission('manage_forms')
    )
  );

drop policy if exists "form_uploads_update_own_response" on storage.objects;
create policy "form_uploads_update_own_response"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'form-uploads'
    and exists (
      select 1
      from public.form_responses r
      where r.id::text = split_part(name, '/', 1)
        and r.respondent_id = public.current_public_user_id()
    )
  )
  with check (
    bucket_id = 'form-uploads'
    and exists (
      select 1
      from public.form_responses r
      where r.id::text = split_part(name, '/', 1)
        and r.respondent_id = public.current_public_user_id()
    )
  );

drop policy if exists "form_uploads_delete_own_response" on storage.objects;
create policy "form_uploads_delete_own_response"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'form-uploads'
    and (
      exists (
        select 1
        from public.form_responses r
        where r.id::text = split_part(name, '/', 1)
          and r.respondent_id = public.current_public_user_id()
      )
      or public.current_user_has_permission('manage_forms')
    )
  );

comment on policy "form_uploads_insert_own_response" on storage.objects is
  'Respondents may upload files only under {response_id}/... for a response they own; manage_forms holders can always read.';
