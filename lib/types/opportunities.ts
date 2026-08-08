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
  link_url: string;
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
  link_url: string;
  category: OpportunityCategory | null;
  company_name: string | null;
  location: string | null;
  employment_type: EmploymentType | null;
  salary: string | null;
  expires_at: string | null;
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
