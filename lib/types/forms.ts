/**
 * Types for the forms feature (public.forms, form_questions, form_responses, ...).
 * See supabase/migrations/20260721120000_forms_schema.sql,
 * supabase/migrations/20260908010000_form_sections.sql and
 * supabase/migrations/20260909000000_form_banners_and_text_blocks.sql for the
 * source of truth.
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
  | "file_upload"
  | "text_block";

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short_answer", label: "Short answer" },
  { value: "paragraph", label: "Paragraph" },
  { value: "single_select", label: "Single select (radio)" },
  { value: "multi_select", label: "Multi select (checkboxes)" },
  { value: "dropdown", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "file_upload", label: "File upload" },
  { value: "text_block", label: "Text block / message" },
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
  /** Null means the question sits before any section (the form's first page). */
  section_id: string | null;
  options: FormQuestionOption[];
};

/**
 * A section is a title/description text block that also acts as a page
 * break (matching Google Forms) - everything from one section up to the
 * next renders as its own page when filling out the form.
 */
export type FormSection = {
  id: string;
  form_id: string;
  title: string;
  description: string | null;
  order_index: number;
  /** Overrides the form's banner_url on this section's page when set. */
  banner_url: string | null;
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
  banner_url: string | null;
  role_ids: number[];
  position_ids: number[];
  questions: FormQuestion[];
  sections: FormSection[];
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

/** True once a required question has something a respondent actually entered. */
export function isQuestionAnswered(answer: AnswerValue | undefined): boolean {
  return Boolean(
    (answer?.value && answer.value.trim()) ||
      (answer?.selectedOptionIds && answer.selectedOptionIds.length) ||
      answer?.filePath
  );
}

export type FormPage = {
  /** Null for the page of questions before any section (the form's first page). */
  section: FormSection | null;
  questions: FormQuestion[];
};

/**
 * Splits a form's flat questions into pages at each section, matching Google
 * Forms: a section is a page break, and everything up to the next section
 * renders as its own page. A leading page with no section and no questions
 * (a form whose first item is a section) is dropped.
 */
export function groupFormPages(
  questions: FormQuestion[],
  sections: FormSection[]
): FormPage[] {
  const sortedSections = [...sections].sort((a, b) => a.order_index - b.order_index);
  const sortedQuestions = [...questions].sort((a, b) => a.order_index - b.order_index);

  const pages: FormPage[] = [
    { section: null, questions: sortedQuestions.filter((q) => q.section_id === null) },
  ];
  for (const section of sortedSections) {
    pages.push({
      section,
      questions: sortedQuestions.filter((q) => q.section_id === section.id),
    });
  }

  return pages.filter((page) => page.section !== null || page.questions.length > 0);
}
