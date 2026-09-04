"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { hasPermission, type PermissionName } from "@/lib/types/rbac";
import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceBudgetWithActual,
  FinanceCategory,
  FinanceDirection,
  FinanceLedgerSummary,
  FinanceSponsor,
  FinanceTransactionInput,
  FinanceTransactionWithLabels,
} from "@/lib/types/finance";
import { revalidatePath } from "next/cache";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const FINANCES_PATH = "/dashboard/finances";

async function requireFinancePermission(
  permission: PermissionName
): Promise<
  | { ok: true; supabase: ServerSupabaseClient; appUserId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, permission)) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { ok: false, error: "No profile row for this user." };
  return { ok: true, supabase, appUserId };
}

const requireViewFinances = () => requireFinancePermission("view_finances");
const requireManageFinances = () => requireFinancePermission("manage_finances");
const requireManageFinanceSources = () => requireFinancePermission("manage_finance_sources");

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export type LedgerFilters = {
  direction?: FinanceDirection;
  categoryId?: string;
  accountId?: string;
  status?: "unverified" | "verified";
  occurredFrom?: string;
  occurredTo?: string;
};

export async function getFinanceLedger(filters: LedgerFilters = {}): Promise<{
  data: FinanceTransactionWithLabels[];
  summary: FinanceLedgerSummary;
  error: string | null;
}> {
  const emptySummary: FinanceLedgerSummary = {
    total_income_cents: 0,
    total_expense_cents: 0,
    net_cents: 0,
  };

  const auth = await requireViewFinances();
  if (!auth.ok) return { data: [], summary: emptySummary, error: auth.error };
  const { supabase } = auth;

  let query = supabase
    .from("finance_transactions")
    .select(
      "id, account_id, category_id, direction, amount_cents, currency, description, occurred_at, member_id, sponsor_id, source, stripe_object_id, receipt_path, status, verified_by, verified_at, created_by, updated_by, created_on, updated_on"
    )
    .order("occurred_at", { ascending: false });

  if (filters.direction) query = query.eq("direction", filters.direction);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.occurredFrom) query = query.gte("occurred_at", filters.occurredFrom);
  if (filters.occurredTo) query = query.lte("occurred_at", filters.occurredTo);

  const { data: rows, error } = await query;
  if (error) return { data: [], summary: emptySummary, error: error.message };
  if (!rows?.length) return { data: [], summary: emptySummary, error: null };

  const accountIds = [...new Set(rows.map((r) => r.account_id))];
  const categoryIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))] as string[];
  const memberIds = [...new Set(rows.map((r) => r.member_id).filter(Boolean))] as string[];
  const sponsorIds = [...new Set(rows.map((r) => r.sponsor_id).filter(Boolean))] as string[];

  const [{ data: accounts }, { data: categories }, { data: members }, { data: sponsors }] =
    await Promise.all([
      supabase.from("finance_accounts").select("id, name").in("id", accountIds),
      categoryIds.length
        ? supabase.from("finance_categories").select("id, name").in("id", categoryIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      memberIds.length
        ? supabase.from("users").select("id, first_name, last_name").in("id", memberIds)
        : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null }[] }),
      sponsorIds.length
        ? supabase.from("finance_sponsors").select("id, name").in("id", sponsorIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const memberMap = new Map(
    (members ?? []).map((m) => [m.id, [m.first_name, m.last_name].filter(Boolean).join(" ") || null])
  );
  const sponsorMap = new Map((sponsors ?? []).map((s) => [s.id, s.name]));

  const data: FinanceTransactionWithLabels[] = rows.map((r) => ({
    ...r,
    account_name: accountMap.get(r.account_id) ?? "Unknown account",
    category_name: r.category_id ? categoryMap.get(r.category_id) ?? null : null,
    member_name: r.member_id ? memberMap.get(r.member_id) ?? null : null,
    sponsor_name: r.sponsor_id ? sponsorMap.get(r.sponsor_id) ?? null : null,
  }));

  const summary = rows.reduce<FinanceLedgerSummary>(
    (acc, r) => {
      if (r.direction === "income") acc.total_income_cents += r.amount_cents;
      else acc.total_expense_cents += r.amount_cents;
      acc.net_cents = acc.total_income_cents - acc.total_expense_cents;
      return acc;
    },
    { ...emptySummary }
  );

  return { data, summary, error: null };
}

// ---------------------------------------------------------------------------
// Manual transactions (manage_finances)
// ---------------------------------------------------------------------------

export async function createManualTransaction(
  input: FinanceTransactionInput
): Promise<{ error: string | null }> {
  const auth = await requireManageFinances();
  if (!auth.ok) return { error: auth.error };
  const { supabase, appUserId } = auth;

  const { error } = await supabase.from("finance_transactions").insert({
    ...input,
    source: "manual",
    created_by: appUserId,
  });
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

export async function updateManualTransaction(
  id: string,
  input: FinanceTransactionInput
): Promise<{ error: string | null }> {
  const auth = await requireManageFinances();
  if (!auth.ok) return { error: auth.error };
  const { supabase, appUserId } = auth;

  const { error } = await supabase
    .from("finance_transactions")
    .update({ ...input, updated_by: appUserId })
    .eq("id", id)
    .eq("source", "manual");
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

export async function deleteManualTransaction(id: string): Promise<{ error: string | null }> {
  const auth = await requireManageFinances();
  if (!auth.ok) return { error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase
    .from("finance_transactions")
    .delete()
    .eq("id", id)
    .eq("source", "manual");
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

export async function setTransactionVerified(
  id: string,
  verified: boolean
): Promise<{ error: string | null }> {
  const auth = await requireManageFinances();
  if (!auth.ok) return { error: auth.error };
  const { supabase, appUserId } = auth;

  const { error } = await supabase
    .from("finance_transactions")
    .update(
      verified
        ? { status: "verified", verified_by: appUserId, verified_at: new Date().toISOString() }
        : { status: "unverified", verified_by: null, verified_at: null }
    )
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

export type CsvTransactionRow = {
  occurred_at: string;
  description: string | null;
  amount_cents: number;
  direction: FinanceDirection;
  category_id: string | null;
};

/**
 * Bulk-inserts historical transactions (e.g. a bank statement dump) as
 * manual, unverified entries against one account. No dedup: unlike Stripe
 * ingestion or the opportunities CSV import, a bank row has no natural
 * unique key to check against, so re-importing the same file will create
 * duplicates - that's on the operator, not something this can detect.
 */
export async function importFinanceTransactions(
  accountId: string,
  rows: CsvTransactionRow[]
): Promise<{ inserted: number; error: string | null }> {
  const auth = await requireManageFinances();
  if (!auth.ok) return { inserted: 0, error: auth.error };
  const { supabase, appUserId } = auth;

  if (!accountId) return { inserted: 0, error: "Choose an account." };
  if (!rows.length) return { inserted: 0, error: "No rows to import." };

  const { error } = await supabase.from("finance_transactions").insert(
    rows.map((r) => ({
      account_id: accountId,
      category_id: r.category_id,
      direction: r.direction,
      amount_cents: r.amount_cents,
      description: r.description,
      occurred_at: r.occurred_at,
      member_id: null,
      sponsor_id: null,
      source: "manual",
      created_by: appUserId,
    }))
  );
  if (error) return { inserted: 0, error: error.message };

  revalidatePath(FINANCES_PATH);
  return { inserted: rows.length, error: null };
}

// ---------------------------------------------------------------------------
// Categories (manage_finances)
// ---------------------------------------------------------------------------

export async function getFinanceCategories(): Promise<{
  data: FinanceCategory[];
  error: string | null;
}> {
  const auth = await requireViewFinances();
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await auth.supabase
    .from("finance_categories")
    .select("id, name, type, is_active, created_at, updated_at")
    .order("type", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function createFinanceCategory(input: {
  name: string;
  type: FinanceDirection;
}): Promise<{ error: string | null }> {
  const auth = await requireManageFinances();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase.from("finance_categories").insert(input);
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

export async function setFinanceCategoryActive(
  id: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const auth = await requireManageFinances();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase
    .from("finance_categories")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Sponsors (manage_finances)
// ---------------------------------------------------------------------------

export async function getFinanceSponsors(): Promise<{
  data: FinanceSponsor[];
  error: string | null;
}> {
  const auth = await requireViewFinances();
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await auth.supabase
    .from("finance_sponsors")
    .select("id, name, contact_name, contact_email, stripe_customer_id, is_active, created_at, updated_at")
    .order("name", { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function createFinanceSponsor(input: {
  name: string;
  contact_name: string | null;
  contact_email: string | null;
}): Promise<{ error: string | null }> {
  const auth = await requireManageFinances();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase.from("finance_sponsors").insert(input);
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

export async function setFinanceSponsorActive(
  id: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const auth = await requireManageFinances();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase
    .from("finance_sponsors")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Accounts / finance sources (manage_finance_sources)
// ---------------------------------------------------------------------------

export async function getFinanceAccounts(): Promise<{
  data: FinanceAccount[];
  error: string | null;
}> {
  const auth = await requireViewFinances();
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await auth.supabase
    .from("finance_accounts")
    .select("id, name, type, external_id, is_active, created_at, updated_at")
    .order("type", { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function createFinanceAccount(input: {
  name: string;
  type: FinanceAccountType;
  external_id: string | null;
}): Promise<{ error: string | null }> {
  const auth = await requireManageFinanceSources();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase.from("finance_accounts").insert(input);
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

export async function updateFinanceAccount(
  id: string,
  input: { name: string; type: FinanceAccountType; external_id: string | null }
): Promise<{ error: string | null }> {
  const auth = await requireManageFinanceSources();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase
    .from("finance_accounts")
    .update(input)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

export async function setFinanceAccountActive(
  id: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const auth = await requireManageFinanceSources();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase
    .from("finance_accounts")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Budgets (view_finances read, manage_finances write)
// ---------------------------------------------------------------------------

export async function getAcademicYears(): Promise<{
  data: { id: string; label: string; is_current: boolean; start_date: string | null; end_date: string | null }[];
  error: string | null;
}> {
  const auth = await requireViewFinances();
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await auth.supabase
    .from("academic_years")
    .select("id, label, is_current, start_date, end_date")
    .order("start_date", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function getFinanceBudgets(academicYearId: string): Promise<{
  data: FinanceBudgetWithActual[];
  error: string | null;
}> {
  const auth = await requireViewFinances();
  if (!auth.ok) return { data: [], error: auth.error };
  const { supabase } = auth;

  const { data: year, error: yearError } = await supabase
    .from("academic_years")
    .select("start_date, end_date")
    .eq("id", academicYearId)
    .maybeSingle();
  if (yearError) return { data: [], error: yearError.message };

  const { data: budgets, error: budgetsError } = await supabase
    .from("finance_budgets")
    .select("id, category_id, academic_year_id, planned_amount_cents, notes, created_by, updated_by, created_on, updated_on")
    .eq("academic_year_id", academicYearId);
  if (budgetsError) return { data: [], error: budgetsError.message };

  const { data: categories, error: categoriesError } = await supabase
    .from("finance_categories")
    .select("id, name, type")
    .eq("is_active", true)
    .order("type", { ascending: true })
    .order("name", { ascending: true });
  if (categoriesError) return { data: [], error: categoriesError.message };

  let actualsByCategory = new Map<string, number>();
  if (year?.start_date && year?.end_date) {
    const { data: txns, error: txnsError } = await supabase
      .from("finance_transactions")
      .select("category_id, amount_cents")
      .gte("occurred_at", year.start_date)
      .lte("occurred_at", year.end_date);
    if (txnsError) return { data: [], error: txnsError.message };

    actualsByCategory = (txns ?? []).reduce((map, t) => {
      if (!t.category_id) return map;
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount_cents);
      return map;
    }, new Map<string, number>());
  }

  const budgetByCategory = new Map((budgets ?? []).map((b) => [b.category_id, b]));

  const data: FinanceBudgetWithActual[] = (categories ?? []).map((c) => {
    const budget = budgetByCategory.get(c.id);
    return {
      id: budget?.id ?? "",
      category_id: c.id,
      academic_year_id: academicYearId,
      planned_amount_cents: budget?.planned_amount_cents ?? 0,
      notes: budget?.notes ?? null,
      created_by: budget?.created_by ?? "",
      updated_by: budget?.updated_by ?? null,
      created_on: budget?.created_on ?? "",
      updated_on: budget?.updated_on ?? "",
      category_name: c.name,
      category_type: c.type,
      actual_amount_cents: actualsByCategory.get(c.id) ?? 0,
    };
  });

  return { data, error: null };
}

export async function upsertFinanceBudget(input: {
  category_id: string;
  academic_year_id: string;
  planned_amount_cents: number;
  notes: string | null;
}): Promise<{ error: string | null }> {
  const auth = await requireManageFinances();
  if (!auth.ok) return { error: auth.error };
  const { supabase, appUserId } = auth;

  const { data: existing, error: existingError } = await supabase
    .from("finance_budgets")
    .select("id")
    .eq("category_id", input.category_id)
    .eq("academic_year_id", input.academic_year_id)
    .maybeSingle();
  if (existingError) return { error: existingError.message };

  const { error } = existing
    ? await supabase
        .from("finance_budgets")
        .update({
          planned_amount_cents: input.planned_amount_cents,
          notes: input.notes,
          updated_by: appUserId,
        })
        .eq("id", existing.id)
    : await supabase.from("finance_budgets").insert({
        ...input,
        created_by: appUserId,
        updated_by: appUserId,
      });
  if (error) return { error: error.message };

  revalidatePath(FINANCES_PATH);
  return { error: null };
}
