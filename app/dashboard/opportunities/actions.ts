"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { hasPermission } from "@/lib/types/rbac";
import {
  OPPORTUNITIES_PAGE_SIZE,
  type ActiveOpportunity,
  type CsvOpportunityRow,
  type LinkableForm,
  type Opportunity,
  type OpportunityInput,
} from "@/lib/types/opportunities";
import { revalidatePath } from "next/cache";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function requireManageOpportunities(): Promise<
  | { ok: true; supabase: ServerSupabaseClient; appUserId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_opportunities")) {
    return { ok: false, error: "You do not have permission to manage opportunities." };
  }
  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { ok: false, error: "No profile row for this user." };
  return { ok: true, supabase, appUserId };
}

const OPPORTUNITY_COLUMNS =
  "id, title, description, link_url, linked_form_id, category, icon_url, company_name, location, employment_type, salary, source, external_id, field, is_active, display_order, expires_at, notify_members, notified_at, created_at, updated_at";

/**
 * Fans out a "new opportunity" notification if eligible — see
 * notify_new_opportunity() in supabase/migrations/20260828130000_notifications_schema.sql.
 * Self-guarded/idempotent (notify_members, is_active, not-expired, not
 * already sent), so safe to call after any mutation without checking state
 * here first. Notification delivery is a non-critical side effect: errors
 * are logged, never surfaced to the caller.
 */
async function notifyOpportunity(supabase: ServerSupabaseClient, id: string) {
  const { error } = await supabase.rpc("notify_new_opportunity", {
    p_opportunity_id: id,
  });
  if (error) {
    console.error("[opportunities] notify_new_opportunity:", error.message);
  }
}

function escapeIlike(value: string): string {
  return `%${value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

// ---------------------------------------------------------------------------
// Member-facing
// ---------------------------------------------------------------------------

export type GetActiveOpportunitiesOptions = {
  page?: number;
  pageSize?: number;
  /** Case-insensitive substring match against title. */
  search?: string;
  /** Exact match against location (from getOpportunityLocations' distinct list). */
  location?: string;
};

export async function getActiveOpportunities(
  options?: GetActiveOpportunitiesOptions
): Promise<{
  data: ActiveOpportunity[];
  totalCount: number;
  error: string | null;
}> {
  const supabase = await createClient();

  const pageSize = Math.min(Math.max(options?.pageSize ?? OPPORTUNITIES_PAGE_SIZE, 1), 100);
  const page = Math.max(options?.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("active_opportunities")
    .select(
      "id, title, description, link_url, linked_form_id, category, icon_url, company_name, location, employment_type, salary, field",
      { count: "exact" }
    );

  const search = options?.search?.trim();
  if (search) {
    query = query.ilike("title", escapeIlike(search));
  }

  const location = options?.location?.trim();
  if (location) {
    query = query.eq("location", location);
  }

  const { data, error, count } = await query
    .order("is_internal", { ascending: false })
    .order("display_order", { ascending: true })
    .range(from, to);

  if (error) return { data: [], totalCount: 0, error: error.message };
  return { data: (data ?? []) as ActiveOpportunity[], totalCount: count ?? 0, error: null };
}

/** Distinct, sorted location values (from currently-active opportunities) for the location filter dropdown. */
export async function getOpportunityLocations(): Promise<{
  data: string[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("active_opportunities")
    .select("location")
    .not("location", "is", null);

  if (error) return { data: [], error: error.message };

  const unique = [
    ...new Set(
      (data ?? [])
        .map((row) => row.location?.trim())
        .filter((v): v is string => Boolean(v))
    ),
  ].sort((a, b) => a.localeCompare(b));

  return { data: unique, error: null };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Forms available for the "link to an internal form" picker — any status, since
 * an officer may want to wire this up before publishing the form. Uses a
 * SECURITY DEFINER RPC because forms_select_manage RLS only grants visibility
 * to manage_forms holders, not manage_opportunities holders. */
export async function getFormsForOpportunityLinking(): Promise<{
  data: LinkableForm[];
  error: string | null;
}> {
  const gate = await requireManageOpportunities();
  if (!gate.ok) return { data: [], error: gate.error };

  const { data, error } = await gate.supabase.rpc("list_forms_for_opportunity_linking");

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as LinkableForm[], error: null };
}

export async function getOpportunitiesForManage(): Promise<{
  data: Opportunity[];
  error: string | null;
}> {
  const gate = await requireManageOpportunities();
  if (!gate.ok) return { data: [], error: gate.error };

  const { data, error } = await gate.supabase
    .from("opportunities")
    .select(OPPORTUNITY_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Opportunity[], error: null };
}

export async function createOpportunity(
  input: OpportunityInput
): Promise<{ id: string | null; error: string | null }> {
  const gate = await requireManageOpportunities();
  if (!gate.ok) return { id: null, error: gate.error };

  const title = input.title.trim();
  const link_url = input.link_url?.trim() || null;
  const linked_form_id = input.linked_form_id || null;
  if (!title) return { id: null, error: "Title is required." };
  if (!link_url && !linked_form_id) {
    return { id: null, error: "Provide a link or select a form." };
  }
  if (link_url && linked_form_id) {
    return {
      id: null,
      error: "Choose either an external link or an internal form, not both.",
    };
  }

  const { data, error } = await gate.supabase
    .from("opportunities")
    .insert({
      title,
      link_url,
      linked_form_id,
      description: input.description?.trim() || null,
      category: input.category,
      company_name: input.company_name?.trim() || null,
      location: input.location?.trim() || null,
      employment_type: input.employment_type,
      salary: input.salary?.trim() || null,
      expires_at: input.expires_at,
      notify_members: input.notify_members,
      source: "manual",
      created_by: gate.appUserId,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  const newId = data.id as string;
  await notifyOpportunity(gate.supabase, newId);
  revalidatePath("/dashboard/opportunities/manage");
  revalidatePath("/dashboard/opportunities");
  return { id: newId, error: null };
}

export async function updateOpportunity(
  id: string,
  input: OpportunityInput
): Promise<{ error: string | null }> {
  const gate = await requireManageOpportunities();
  if (!gate.ok) return { error: gate.error };

  const title = input.title.trim();
  const link_url = input.link_url?.trim() || null;
  const linked_form_id = input.linked_form_id || null;
  if (!title) return { error: "Title is required." };
  if (!link_url && !linked_form_id) {
    return { error: "Provide a link or select a form." };
  }
  if (link_url && linked_form_id) {
    return { error: "Choose either an external link or an internal form, not both." };
  }

  const { error } = await gate.supabase
    .from("opportunities")
    .update({
      title,
      link_url,
      linked_form_id,
      description: input.description?.trim() || null,
      category: input.category,
      company_name: input.company_name?.trim() || null,
      location: input.location?.trim() || null,
      employment_type: input.employment_type,
      salary: input.salary?.trim() || null,
      expires_at: input.expires_at,
      notify_members: input.notify_members,
      updated_by: gate.appUserId,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  await notifyOpportunity(gate.supabase, id);
  revalidatePath("/dashboard/opportunities/manage");
  revalidatePath("/dashboard/opportunities");
  return { error: null };
}

export async function setOpportunityActive(
  id: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const gate = await requireManageOpportunities();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("opportunities")
    .update({ is_active: isActive, updated_by: gate.appUserId })
    .eq("id", id);

  if (error) return { error: error.message };
  await notifyOpportunity(gate.supabase, id);
  revalidatePath("/dashboard/opportunities/manage");
  revalidatePath("/dashboard/opportunities");
  return { error: null };
}

/** Flip whether an opportunity notifies members — lets an officer opt a single
 * already-imported row in without a full edit. Notifies immediately if it's
 * already active (subject to the usual notify_new_opportunity guard). */
export async function setOpportunityNotify(
  id: string,
  notify: boolean
): Promise<{ error: string | null }> {
  const gate = await requireManageOpportunities();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("opportunities")
    .update({ notify_members: notify, updated_by: gate.appUserId })
    .eq("id", id);

  if (error) return { error: error.message };
  await notifyOpportunity(gate.supabase, id);
  revalidatePath("/dashboard/opportunities/manage");
  revalidatePath("/dashboard/opportunities");
  return { error: null };
}

export async function bulkSetOpportunitiesActive(
  ids: string[],
  isActive: boolean
): Promise<{ error: string | null; updated: number }> {
  const gate = await requireManageOpportunities();
  if (!gate.ok) return { error: gate.error, updated: 0 };
  if (!ids.length) return { error: null, updated: 0 };

  const { error } = await gate.supabase
    .from("opportunities")
    .update({ is_active: isActive, updated_by: gate.appUserId })
    .in("id", ids);

  if (error) return { error: error.message, updated: 0 };
  await Promise.all(ids.map((id) => notifyOpportunity(gate.supabase, id)));
  revalidatePath("/dashboard/opportunities/manage");
  revalidatePath("/dashboard/opportunities");
  return { error: null, updated: ids.length };
}

export async function deleteOpportunity(id: string): Promise<{ error: string | null }> {
  const gate = await requireManageOpportunities();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from("opportunities").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/opportunities/manage");
  revalidatePath("/dashboard/opportunities");
  return { error: null };
}

export async function importOpportunitiesCsv(rows: CsvOpportunityRow[]): Promise<{
  inserted: number;
  skipped_duplicates: number;
  error: string | null;
}> {
  const gate = await requireManageOpportunities();
  if (!gate.ok) return { inserted: 0, skipped_duplicates: 0, error: gate.error };

  if (!rows.length) {
    return { inserted: 0, skipped_duplicates: 0, error: "No rows to import." };
  }

  const externalIds = rows.map((r) => r.external_id);
  const { data: existing, error: existingErr } = await gate.supabase
    .from("opportunities")
    .select("external_id")
    .in("external_id", externalIds);
  if (existingErr) {
    return { inserted: 0, skipped_duplicates: 0, error: existingErr.message };
  }

  const existingIds = new Set((existing ?? []).map((r) => r.external_id));
  const toInsert = rows.filter((r) => !existingIds.has(r.external_id));
  const skipped = rows.length - toInsert.length;

  if (!toInsert.length) {
    return { inserted: 0, skipped_duplicates: skipped, error: null };
  }

  const { error: insertErr } = await gate.supabase.from("opportunities").insert(
    toInsert.map((r) => ({
      title: r.title,
      link_url: r.link_url,
      description: r.description,
      company_name: r.company_name,
      location: r.location,
      employment_type: r.employment_type,
      salary: r.salary,
      external_id: r.external_id,
      field: r.field,
      source: "csv_import",
      is_active: false,
      category: "Job",
      created_by: gate.appUserId,
    }))
  );

  if (insertErr) return { inserted: 0, skipped_duplicates: skipped, error: insertErr.message };

  revalidatePath("/dashboard/opportunities/manage");
  return { inserted: toInsert.length, skipped_duplicates: skipped, error: null };
}
