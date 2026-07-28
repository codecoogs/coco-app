/**
 * Types for the forms feature (public.forms, form_questions, form_responses, ...).
 * See supabase/migrations/20260721120000_forms_schema.sql for the source of truth.
 */

export type FormStatus = "draft" | "published" | "closed";

export type FormAudienceType = "everyone" | "roles" | "positions";

export type QuestionType =
  | "short_answer"
  | "paragraph"
  | "single_select"
  | "multi_select"
  | "dropdown"
  | "date"
  | "file_upload";

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short_answer", label: "Short answer" },
  { value: "paragraph", label: "Paragraph" },
  { value: "single_select", label: "Single select (radio)" },
  { value: "multi_select", label: "Multi select (checkboxes)" },
  { value: "dropdown", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "file_upload", label: "File upload" },
];

/** Question types that need a list of options in the builder. */
export const OPTION_BASED_TYPES: readonly QuestionType[] = [
  "single_select",
  "multi_select",
  "dropdown",
];

export type AutofillSource =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "classification"
  | "expected_graduation"
  | "major"
  | "discord";

export const AUTOFILL_SOURCES: { value: AutofillSource; label: string }[] = [
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "classification", label: "Classification" },
  { value: "expected_graduation", label: "Expected graduation" },
  { value: "major", label: "Major" },
  { value: "discord", label: "Discord" },
];

export type FormQuestionOption = {
  id: string;
  question_id: string;
  label: string;
  order_index: number;
};

export type FormQuestion = {
  id: string;
  form_id: string;
  type: QuestionType;
  label: string;
  help_text: string | null;
  is_required: boolean;
  order_index: number;
  autofill_source: AutofillSource | null;
  options: FormQuestionOption[];
};

export type FormSummary = {
  id: string;
  title: string;
  description: string | null;
  status: FormStatus;
  audience_type: FormAudienceType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  response_count: number;
};

export type FormAudienceSelection = {
  audience_type: FormAudienceType;
  role_ids: number[];
  position_ids: number[];
};

export type FormWithQuestions = {
  id: string;
  title: string;
  description: string | null;
  status: FormStatus;
  audience_type: FormAudienceType;
  is_active: boolean;
  role_ids: number[];
  position_ids: number[];
  questions: FormQuestion[];
};

/** A single answer as edited/submitted in the fill-out UI, keyed by question id. */
export type AnswerValue = {
  value?: string | null;
  selectedOptionIds?: string[];
  filePath?: string | null;
  fileName?: string | null;
};

export type ResponseRow = {
  id: string;
  form_id: string;
  respondent_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  submitted_at: string;
  updated_at: string;
  answers: Record<string, AnswerValue>;
};
