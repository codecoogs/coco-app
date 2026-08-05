/**
 * Types for the finance feature (public.finance_*).
 * See supabase/migrations/20260804120000_finance_schema.sql for the source of truth.
 */

export type FinanceDirection = "income" | "expense";

export type FinanceAccountType =
  | "stripe_memberships"
  | "stripe_sponsors"
  | "tdecu_manual";

export const FINANCE_ACCOUNT_TYPES: FinanceAccountType[] = [
  "stripe_memberships",
  "stripe_sponsors",
  "tdecu_manual",
];

export type FinanceTransactionSource = "stripe" | "manual";

export type FinanceTransactionStatus = "unverified" | "verified";

export type FinanceCategory = {
  id: string;
  name: string;
  type: FinanceDirection;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinanceSponsor = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  stripe_customer_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinanceAccount = {
  id: string;
  name: string;
  type: FinanceAccountType;
  external_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinanceTransaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  direction: FinanceDirection;
  amount_cents: number;
  currency: string;
  description: string | null;
  occurred_at: string;
  member_id: string | null;
  sponsor_id: string | null;
  source: FinanceTransactionSource;
  stripe_object_id: string | null;
  receipt_path: string | null;
  status: FinanceTransactionStatus;
  verified_by: string | null;
  verified_at: string | null;
  created_by: string;
  updated_by: string | null;
  created_on: string;
  updated_on: string;
};

/** Ledger row joined with display-friendly labels, for the read-only/manage tables. */
export type FinanceTransactionWithLabels = FinanceTransaction & {
  account_name: string;
  category_name: string | null;
  member_name: string | null;
  sponsor_name: string | null;
};

export type FinanceTransactionInput = {
  account_id: string;
  category_id: string | null;
  direction: FinanceDirection;
  amount_cents: number;
  description: string | null;
  occurred_at: string;
  member_id: string | null;
  sponsor_id: string | null;
};

export type FinanceBudget = {
  id: string;
  category_id: string;
  academic_year_id: string;
  planned_amount_cents: number;
  notes: string | null;
  created_by: string;
  updated_by: string | null;
  created_on: string;
  updated_on: string;
};

export type FinanceBudgetWithActual = FinanceBudget & {
  category_name: string;
  category_type: FinanceDirection;
  actual_amount_cents: number;
};

export type FinanceStripeSyncLogEntry = {
  id: string;
  account_id: string | null;
  stripe_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
};

/** Aggregate totals for the read-only ledger view. */
export type FinanceLedgerSummary = {
  total_income_cents: number;
  total_expense_cents: number;
  net_cents: number;
};
