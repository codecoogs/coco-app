"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { hasPermission } from "@/lib/types/rbac";
import type {
  AnswerValue,
  AutofillSource,
  FormAudienceSelection,
  FormQuestion,
  FormQuestionOption,
  FormStatus,
  FormSummary,
  FormWithQuestions,
  QuestionType,
  ResponseRow,
} from "@/lib/types/forms";
import { OPTION_BASED_TYPES } from "@/lib/types/forms";
import { revalidatePath } from "next/cache";

const SERVICE_ROLE_ERROR =
  "SUPABASE_SERVICE_ROLE_KEY is not set on the server. Forms admin needs the service role key to load roles/positions and respondent identities.";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function requireManageForms(): Promise<
  | { ok: true; supabase: ServerSupabaseClient; appUserId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_forms")) {
    return { ok: false, error: "You do not have permission to manage forms." };
  }
  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { ok: false, error: "No profile row for this user." };
  return { ok: true, supabase, appUserId };
}

async function requireSignedIn(): Promise<
  | { ok: true; supabase: ServerSupabaseClient; appUserId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };
  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { ok: false, error: "No profile row for this user." };
  return { ok: true, supabase, appUserId };
}

// ---------------------------------------------------------------------------
// Admin: forms list
// ---------------------------------------------------------------------------

export async function getForms(): Promise<{
  data: FormSummary[];
  error: string | null;
}> {
  const gate = await requireManageForms();
  if (!gate.ok) return { data: [], error: gate.error };

  const { data, error } = await gate.supabase
    .from("forms")
    .select(
      "id, title, description, status, audience_type, is_active, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  const forms = data ?? [];
  const formIds = forms.map((f) => f.id);

  const counts = new Map<string, number>();
  if (formIds.length) {
    const { data: responseRows, error: countErr } = await gate.supabase
      .from("form_responses")
      .select("form_id")
      .in("form_id", formIds);
    if (countErr) return { data: [], error: countErr.message };
    for (const r of responseRows ?? []) {
      counts.set(r.form_id, (counts.get(r.form_id) ?? 0) + 1);
    }
  }

  return {
    data: forms.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      audience_type: r.audience_type,
      is_active: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at,
      response_count: counts.get(r.id) ?? 0,
    })),
    error: null,
  };
}

export type RoleOption = { id: number; name: string };
export type PositionOption = { id: number; title: string };

export async function getAudienceOptions(): Promise<{
  roles: RoleOption[];
  positions: PositionOption[];
  error: string | null;
}> {
  const gate = await requireManageForms();
  if (!gate.ok) return { roles: [], positions: [], error: gate.error };

  const admin = getServiceRoleClient();
  if (!admin) return { roles: [], positions: [], error: SERVICE_ROLE_ERROR };

  const [rolesRes, positionsRes] = await Promise.all([
    admin.from("roles").select("id, name").order("name"),
    admin
      .from("positions")
      .select("id, title")
      .eq("is_active", true)
      .order("title"),
  ]);

  if (rolesRes.error) {
    return { roles: [], positions: [], error: rolesRes.error.message };
  }
  if (positionsRes.error) {
    return { roles: [], positions: [], error: positionsRes.error.message };
  }

  return {
    roles: (rolesRes.data ?? []) as RoleOption[],
    positions: (positionsRes.data ?? []) as PositionOption[],
    error: null,
  };
}

export async function createForm(
  title: string
): Promise<{ id: string | null; error: string | null }> {
  const gate = await requireManageForms();
  if (!gate.ok) return { id: null, error: gate.error };

  const trimmed = title.trim();
  if (!trimmed) return { id: null, error: "Title is required." };

  const { data, error } = await gate.supabase
    .from("forms")
    .insert({ title: trimmed, created_by: gate.appUserId })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  revalidatePath("/dashboard/forms/manage");
  return { id: data.id as string, error: null };
}

export async function updateFormMeta(
  formId: string,
  input: { title: string; description: string | null }
): Promise<{ error: string | null }> {
  const gate = await requireManageForms();
  if (!gate.ok) return { error: gate.error };

  const trimmed = input.title.trim();
  if (!trimmed) return { error: "Title is required." };

  const { error } = await gate.supabase
    .from("forms")
    .update({
      title: trimmed,
      description: input.description?.trim() || null,
      updated_by: gate.appUserId,
    })
    .eq("id", formId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/forms/manage");
  revalidatePath(`/dashboard/forms/manage/${formId}/edit`);
  return { error: null };
}

export async function updateFormAudience(
  formId: string,
  selection: FormAudienceSelection
): Promise<{ error: string | null }> {
  const gate = await requireManageForms();
  if (!gate.ok) return { error: gate.error };

  const { error: updateErr } = await gate.supabase
    .from("forms")
    .update({ audience_type: selection.audience_type, updated_by: gate.appUserId })
    .eq("id", formId);
  if (updateErr) return { error: updateErr.message };

  const { error: delRolesErr } = await gate.supabase
    .from("form_audience_roles")
    .delete()
    .eq("form_id", formId);
  if (delRolesErr) return { error: delRolesErr.message };

  const { error: delPositionsErr } = await gate.supabase
    .from("form_audience_positions")
    .delete()
    .eq("form_id", formId);
  if (delPositionsErr) return { error: delPositionsErr.message };

  if (selection.audience_type === "roles" && selection.role_ids.length) {
    const { error } = await gate.supabase.from("form_audience_roles").insert(
      selection.role_ids.map((role_id) => ({ form_id: formId, role_id }))
    );
    if (error) return { error: error.message };
  }

  if (selection.audience_type === "positions" && selection.position_ids.length) {
    const { error } = await gate.supabase.from("form_audience_positions").insert(
      selection.position_ids.map((position_id) => ({ form_id: formId, position_id }))
    );
    if (error) return { error: error.message };
  }

  revalidatePath(`/dashboard/forms/manage/${formId}/edit`);
  return { error: null };
}

export async function setFormStatus(
  formId: string,
  status: FormStatus
): Promise<{ error: string | null }> {
  const gate = await requireManageForms();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("forms")
    .update({ status, updated_by: gate.appUserId })
    .eq("id", formId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/forms/manage");
  revalidatePath(`/dashboard/forms/manage/${formId}/edit`);
  return { error: null };
}

export async function archiveForm(
  formId: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const gate = await requireManageForms();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("forms")
    .update({ is_active: isActive, updated_by: gate.appUserId })
    .eq("id", formId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/forms/manage");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Admin: builder (questions + options)
// ---------------------------------------------------------------------------

export async function getFormForEdit(formId: string): Promise<{
  data: FormWithQuestions | null;
  error: string | null;
}> {
  const gate = await requireManageForms();
  if (!gate.ok) return { data: null, error: gate.error };

  const { data: form, error: formErr } = await gate.supabase
    .from("forms")
    .select("id, title, description, status, audience_type, is_active")
    .eq("id", formId)
    .maybeSingle();
  if (formErr) return { data: null, error: formErr.message };
  if (!form) return { data: null, error: "Form not found." };

  const [questionsRes, rolesRes, positionsRes] = await Promise.all([
    gate.supabase
      .from("form_questions")
      .select(
        "id, form_id, type, label, help_text, is_required, order_index, autofill_source, form_question_options(id, question_id, label, order_index)"
      )
      .eq("form_id", formId)
      .order("order_index", { ascending: true }),
    gate.supabase.from("form_audience_roles").select("role_id").eq("form_id", formId),
    gate.supabase
      .from("form_audience_positions")
      .select("position_id")
      .eq("form_id", formId),
  ]);

  if (questionsRes.error) return { data: null, error: questionsRes.error.message };
  if (rolesRes.error) return { data: null, error: rolesRes.error.message };
  if (positionsRes.error) return { data: null, error: positionsRes.error.message };

  const questions: FormQuestion[] = (questionsRes.data ?? []).map((q) => ({
    id: q.id,
    form_id: q.form_id,
    type: q.type as QuestionType,
    label: q.label,
    help_text: q.help_text,
    is_required: q.is_required,
    order_index: q.order_index,
    autofill_source: q.autofill_source as AutofillSource | null,
    options: ((q.form_question_options ?? []) as FormQuestionOption[])
      .slice()
      .sort((a, b) => a.order_index - b.order_index),
  }));

  return {
    data: {
      id: form.id,
      title: form.title,
      description: form.description,
      status: form.status,
      audience_type: form.audience_type,
      is_active: form.is_active,
      role_ids: (rolesRes.data ?? []).map((r) => r.role_id),
      position_ids: (positionsRes.data ?? []).map((p) => p.position_id),
      questions,
    },
    error: null,
  };
}

export type QuestionInput = {
  type: QuestionType;
  label: string;
  help_text: string | null;
  is_required: boolean;
  autofill_source: AutofillSource | null;
  options: string[];
};

export async function createQuestion(
  formId: string,
  input: QuestionInput
): Promise<{ id: string | null; error: string | null }> {
  const gate = await requireManageForms();
  if (!gate.ok) return { id: null, error: gate.error };

  const trimmedLabel = input.label.trim();
  if (!trimmedLabel) return { id: null, error: "Question label is required." };

  const { count } = await gate.supabase
    .from("form_questions")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId);

  const { data: question, error } = await gate.supabase
    .from("form_questions")
    .insert({
      form_id: formId,
      type: input.type,
      label: trimmedLabel,
      help_text: input.help_text?.trim() || null,
      is_required: input.is_required,
      autofill_source: input.autofill_source,
      order_index: count ?? 0,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };

  if (OPTION_BASED_TYPES.includes(input.type) && input.options.length) {
    const { error: optErr } = await gate.supabase.from("form_question_options").insert(
      input.options
        .filter((label) => label.trim())
        .map((label, idx) => ({
          question_id: question.id as string,
          label: label.trim(),
          order_index: idx,
        }))
    );
    if (optErr) return { id: null, error: optErr.message };
  }

  revalidatePath(`/dashboard/forms/manage/${formId}/edit`);
  return { id: question.id as string, error: null };
}

export async function updateQuestion(
  questionId: string,
  input: QuestionInput
): Promise<{ error: string | null }> {
  const gate = await requireManageForms();
  if (!gate.ok) return { error: gate.error };

  const trimmedLabel = input.label.trim();
  if (!trimmedLabel) return { error: "Question label is required." };

  const { data: existing, error: fetchErr } = await gate.supabase
    .from("form_questions")
    .select("form_id")
    .eq("id", questionId)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message };
  if (!existing) return { error: "Question not found." };

  const { error } = await gate.supabase
    .from("form_questions")
    .update({
      type: input.type,
      label: trimmedLabel,
      help_text: input.help_text?.trim() || null,
      is_required: input.is_required,
      autofill_source: input.autofill_source,
    })
    .eq("id", questionId);
  if (error) return { error: error.message };

  const { error: delErr } = await gate.supabase
    .from("form_question_options")
    .delete()
    .eq("question_id", questionId);
  if (delErr) return { error: delErr.message };

  if (OPTION_BASED_TYPES.includes(input.type) && input.options.length) {
    const { error: optErr } = await gate.supabase.from("form_question_options").insert(
      input.options
        .filter((label) => label.trim())
        .map((label, idx) => ({
          question_id: questionId,
          label: label.trim(),
          order_index: idx,
        }))
    );
    if (optErr) return { error: optErr.message };
  }

  revalidatePath(`/dashboard/forms/manage/${existing.form_id}/edit`);
  return { error: null };
}

export async function deleteQuestion(
  questionId: string,
  formId: string
): Promise<{ error: string | null }> {
  const gate = await requireManageForms();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("form_questions")
    .delete()
    .eq("id", questionId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/forms/manage/${formId}/edit`);
  return { error: null };
}

export async function reorderQuestions(
  formId: string,
  orderedQuestionIds: string[]
): Promise<{ error: string | null }> {
  const gate = await requireManageForms();
  if (!gate.ok) return { error: gate.error };

  const results = await Promise.all(
    orderedQuestionIds.map((id, idx) =>
      gate.supabase
        .from("form_questions")
        .update({ order_index: idx })
        .eq("id", id)
        .eq("form_id", formId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath(`/dashboard/forms/manage/${formId}/edit`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Admin: responses + CSV export data
// ---------------------------------------------------------------------------

export async function getResponses(formId: string): Promise<{
  questions: FormQuestion[];
  responses: ResponseRow[];
  error: string | null;
}> {
  const gate = await requireManageForms();
  if (!gate.ok) return { questions: [], responses: [], error: gate.error };

  const { data: questionsData, error: questionsErr } = await gate.supabase
    .from("form_questions")
    .select(
      "id, form_id, type, label, help_text, is_required, order_index, autofill_source, form_question_options(id, question_id, label, order_index)"
    )
    .eq("form_id", formId)
    .order("order_index", { ascending: true });
  if (questionsErr) return { questions: [], responses: [], error: questionsErr.message };

  const questions: FormQuestion[] = (questionsData ?? []).map((q) => ({
    id: q.id,
    form_id: q.form_id,
    type: q.type as QuestionType,
    label: q.label,
    help_text: q.help_text,
    is_required: q.is_required,
    order_index: q.order_index,
    autofill_source: q.autofill_source as AutofillSource | null,
    options: ((q.form_question_options ?? []) as FormQuestionOption[])
      .slice()
      .sort((a, b) => a.order_index - b.order_index),
  }));

  const { data: responseRows, error: responsesErr } = await gate.supabase
    .from("form_responses")
    .select(
      "id, form_id, respondent_id, submitted_at, updated_at, form_response_answers(question_id, value, selected_option_ids, file_path)"
    )
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });
  if (responsesErr) return { questions, responses: [], error: responsesErr.message };

  const respondentIds = [...new Set((responseRows ?? []).map((r) => r.respondent_id))];

  let usersById = new Map<
    string,
    { first_name: string | null; last_name: string | null; email: string | null }
  >();
  if (respondentIds.length) {
    const admin = getServiceRoleClient();
    if (!admin) return { questions, responses: [], error: SERVICE_ROLE_ERROR };
    const { data: users, error: usersErr } = await admin
      .from("users")
      .select("id, first_name, last_name, email")
      .in("id", respondentIds);
    if (usersErr) return { questions, responses: [], error: usersErr.message };
    usersById = new Map((users ?? []).map((u) => [u.id as string, u]));
  }

  const responses: ResponseRow[] = (responseRows ?? []).map((r) => {
    const answers: Record<string, AnswerValue> = {};
    for (const a of r.form_response_answers ?? []) {
      answers[a.question_id] = {
        value: a.value,
        selectedOptionIds: a.selected_option_ids ?? undefined,
        filePath: a.file_path,
      };
    }
    const u = usersById.get(r.respondent_id);
    return {
      id: r.id,
      form_id: r.form_id,
      respondent_id: r.respondent_id,
      first_name: u?.first_name ?? null,
      last_name: u?.last_name ?? null,
      email: u?.email ?? null,
      submitted_at: r.submitted_at,
      updated_at: r.updated_at,
      answers,
    };
  });

  return { questions, responses, error: null };
}

export async function getSignedFileUrl(
  filePath: string
): Promise<{ url: string | null; error: string | null }> {
  const gate = await requireManageForms();
  if (!gate.ok) return { url: null, error: gate.error };

  const { data, error } = await gate.supabase.storage
    .from("form-uploads")
    .createSignedUrl(filePath, 60 * 10);
  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl, error: null };
}

// ---------------------------------------------------------------------------
// Respondent: list + fill out
// ---------------------------------------------------------------------------

export type RespondentFormListItem = {
  id: string;
  title: string;
  description: string | null;
  has_responded: boolean;
};

export async function getFormsForRespondent(): Promise<{
  data: RespondentFormListItem[];
  error: string | null;
}> {
  const gate = await requireSignedIn();
  if (!gate.ok) return { data: [], error: gate.error };

  const { data: forms, error } = await gate.supabase
    .from("forms")
    .select("id, title, description")
    .eq("status", "published")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };

  const { data: myResponses } = await gate.supabase
    .from("form_responses")
    .select("form_id")
    .eq("respondent_id", gate.appUserId);
  const respondedIds = new Set((myResponses ?? []).map((r) => r.form_id));

  return {
    data: (forms ?? []).map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      has_responded: respondedIds.has(f.id),
    })),
    error: null,
  };
}

export type FillableForm = {
  id: string;
  title: string;
  description: string | null;
  status: FormStatus;
  questions: FormQuestion[];
};

export async function getFormToFill(formId: string): Promise<{
  form: FillableForm | null;
  answers: Record<string, AnswerValue>;
  responseId: string | null;
  error: string | null;
}> {
  const gate = await requireSignedIn();
  if (!gate.ok) return { form: null, answers: {}, responseId: null, error: gate.error };

  const { data: form, error: formErr } = await gate.supabase
    .from("forms")
    .select("id, title, description, status")
    .eq("id", formId)
    .maybeSingle();
  if (formErr) return { form: null, answers: {}, responseId: null, error: formErr.message };
  if (!form) return { form: null, answers: {}, responseId: null, error: "Form not found." };

  const { data: questionsData, error: questionsErr } = await gate.supabase
    .from("form_questions")
    .select(
      "id, form_id, type, label, help_text, is_required, order_index, autofill_source, form_question_options(id, question_id, label, order_index)"
    )
    .eq("form_id", formId)
    .order("order_index", { ascending: true });
  if (questionsErr) {
    return { form: null, answers: {}, responseId: null, error: questionsErr.message };
  }

  const questions: FormQuestion[] = (questionsData ?? []).map((q) => ({
    id: q.id,
    form_id: q.form_id,
    type: q.type as QuestionType,
    label: q.label,
    help_text: q.help_text,
    is_required: q.is_required,
    order_index: q.order_index,
    autofill_source: q.autofill_source as AutofillSource | null,
    options: ((q.form_question_options ?? []) as FormQuestionOption[])
      .slice()
      .sort((a, b) => a.order_index - b.order_index),
  }));

  const { data: profileRow } = await gate.supabase
    .from("users")
    .select(
      "first_name, last_name, email, phone, classification, expected_graduation, major, discord"
    )
    .eq("id", gate.appUserId)
    .maybeSingle();

  const { data: existingResponse } = await gate.supabase
    .from("form_responses")
    .select("id, form_response_answers(question_id, value, selected_option_ids, file_path)")
    .eq("form_id", formId)
    .eq("respondent_id", gate.appUserId)
    .maybeSingle();

  const answers: Record<string, AnswerValue> = {};
  for (const q of questions) {
    if (q.autofill_source && profileRow) {
      const raw = (profileRow as Record<string, unknown>)[q.autofill_source];
      if (typeof raw === "string" && raw) answers[q.id] = { value: raw };
    }
  }
  for (const a of existingResponse?.form_response_answers ?? []) {
    answers[a.question_id] = {
      value: a.value,
      selectedOptionIds: a.selected_option_ids ?? undefined,
      filePath: a.file_path,
    };
  }

  return {
    form: {
      id: form.id,
      title: form.title,
      description: form.description,
      status: form.status,
      questions,
    },
    answers,
    responseId: existingResponse?.id ?? null,
    error: null,
  };
}

/** Upserts (creates if missing) the caller's response row so file uploads have a folder to write into. */
export async function ensureResponseId(
  formId: string
): Promise<{ id: string | null; error: string | null }> {
  const gate = await requireSignedIn();
  if (!gate.ok) return { id: null, error: gate.error };

  const { data: existing, error: fetchErr } = await gate.supabase
    .from("form_responses")
    .select("id")
    .eq("form_id", formId)
    .eq("respondent_id", gate.appUserId)
    .maybeSingle();
  if (fetchErr) return { id: null, error: fetchErr.message };
  if (existing) return { id: existing.id as string, error: null };

  const { data: inserted, error: insertErr } = await gate.supabase
    .from("form_responses")
    .insert({ form_id: formId, respondent_id: gate.appUserId })
    .select("id")
    .single();
  if (insertErr) return { id: null, error: insertErr.message };
  return { id: inserted.id as string, error: null };
}

export async function submitResponse(
  formId: string,
  answers: Record<string, AnswerValue>
): Promise<{ error: string | null }> {
  const gate = await requireSignedIn();
  if (!gate.ok) return { error: gate.error };

  const { data: form, error: formErr } = await gate.supabase
    .from("forms")
    .select("status")
    .eq("id", formId)
    .maybeSingle();
  if (formErr) return { error: formErr.message };
  if (!form) return { error: "Form not found." };
  if (form.status !== "published") {
    return { error: "This form is not currently accepting responses." };
  }

  const { data: questions, error: questionsErr } = await gate.supabase
    .from("form_questions")
    .select("id, is_required")
    .eq("form_id", formId);
  if (questionsErr) return { error: questionsErr.message };

  for (const q of questions ?? []) {
    if (!q.is_required) continue;
    const a = answers[q.id];
    const filled =
      (a?.value && a.value.trim()) ||
      (a?.selectedOptionIds && a.selectedOptionIds.length) ||
      a?.filePath;
    if (!filled) return { error: "Please answer all required questions." };
  }

  const ensured = await ensureResponseId(formId);
  if (!ensured.id) return { error: ensured.error ?? "Could not create response." };
  const responseId = ensured.id;

  const rows = Object.entries(answers)
    .filter(([, a]) => a.value || a.selectedOptionIds?.length || a.filePath)
    .map(([questionId, a]) => ({
      response_id: responseId,
      question_id: questionId,
      value: a.value ?? null,
      selected_option_ids: a.selectedOptionIds?.length ? a.selectedOptionIds : null,
      file_path: a.filePath ?? null,
    }));

  if (rows.length) {
    const { error } = await gate.supabase
      .from("form_response_answers")
      .upsert(rows, { onConflict: "response_id,question_id" });
    if (error) return { error: error.message };
  }

  const { error: touchErr } = await gate.supabase
    .from("form_responses")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", responseId);
  if (touchErr) return { error: touchErr.message };

  revalidatePath(`/dashboard/forms/${formId}`);
  revalidatePath("/dashboard/forms");
  return { error: null };
}
