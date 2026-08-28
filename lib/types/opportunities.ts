/**
 * Types for the opportunities feature (public.opportunities).
 * See supabase/migrations/20260728120000_opportunities_schema_extend.sql for the source of truth.
 */

export type OpportunityCategory =
  | "Internship"
  | "Club Role"
  | "Project"
  | "Sponsor"
  | "Job"
  | "Other";

export const OPPORTUNITY_CATEGORIES: OpportunityCategory[] = [
  "Internship",
  "Club Role",
  "Project",
  "Sponsor",
  "Job",
  "Other",
];

/** Categories that show company/location/employment-type/salary fields in the builder. */
export const JOB_SHAPED_CATEGORIES: readonly OpportunityCategory[] = [
  "Internship",
  "Job",
  "Other",
];

export type EmploymentType = "Full-time" | "Part-time" | "Internship" | "Contract";

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  "Full-time",
  "Part-time",
  "Internship",
  "Contract",
];

export type OpportunitySource = "manual" | "csv_import";

/** Page size for the member-facing /dashboard/opportunities browse view. */
export const OPPORTUNITIES_PAGE_SIZE = 20;

export type Opportunity = {
  id: string;
  title: string;
  description: string | null;
  /** Exactly one of link_url / linked_form_id is set — enforced by a DB check constraint. */
  link_url: string | null;
  /** Internal form to route "Apply" to instead of an external URL. */
  linked_form_id: string | null;
  category: OpportunityCategory | null;
  icon_url: string | null;
  company_name: string | null;
  location: string | null;
  employment_type: EmploymentType | null;
  salary: string | null;
  source: OpportunitySource;
  external_id: string | null;
  /** Discipline/search-keyword tag from a CSV import (e.g. "Data Science"). Distinct from category. */
  field: string | null;
  is_active: boolean;
  display_order: number;
  expires_at: string | null;
  /** Whether members get a notification when this becomes visible. Off by default for CSV imports. */
  notify_members: boolean;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Public-facing card shape (subset shown on /dashboard/opportunities before opening the detail panel). */
export type ActiveOpportunity = Pick<
  Opportunity,
  | "id"
  | "title"
  | "description"
  | "link_url"
  | "linked_form_id"
  | "category"
  | "icon_url"
  | "company_name"
  | "location"
  | "employment_type"
  | "salary"
  | "field"
>;

export type OpportunityInput = {
  title: string;
  description: string | null;
  link_url: string | null;
  linked_form_id: string | null;
  category: OpportunityCategory | null;
  company_name: string | null;
  location: string | null;
  employment_type: EmploymentType | null;
  salary: string | null;
  expires_at: string | null;
  notify_members: boolean;
};

/** A form available to link an opportunity to, from list_forms_for_opportunity_linking(). */
export type LinkableForm = {
  id: string;
  title: string;
  status: string;
};

/** One row parsed from an admin CSV upload, ready to import. */
export type CsvOpportunityRow = {
  external_id: string;
  title: string;
  company_name: string;
  location: string | null;
  employment_type: EmploymentType | null;
  salary: string | null;
  description: string | null;
  link_url: string;
  field: string | null;
};
