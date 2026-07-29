"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { hasPermission } from "@/lib/types/rbac";
import type {
  ActiveOpportunity,
  CsvOpportunityRow,
  Opportunity,
  OpportunityInput,
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
  "id, title, description, link_url, category, icon_url, company_name, location, employment_type, salary, source, external_id, is_active, display_order, expires_at, created_at, updated_at";

// ---------------------------------------------------------------------------
// Member-facing
// ---------------------------------------------------------------------------

export async function getActiveOpportunities(): Promise<{
  data: ActiveOpportunity[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("active_opportunities")
    .select(
      "id, title, description, link_url, category, icon_url, company_name, location, employment_type, salary"
    )
    .order("display_order", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ActiveOpportunity[], error: null };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

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
  const link_url = input.link_url.trim();
  if (!title) return { id: null, error: "Title is required." };
  if (!link_url) return { id: null, error: "Link is required." };

  const { data, error } = await gate.supabase
    .from("opportunities")
    .insert({
      title,
      link_url,
      description: input.description?.trim() || null,
      category: input.category,
      company_name: input.company_name?.trim() || null,
      location: input.location?.trim() || null,
      employment_type: input.employment_type,
      salary: input.salary?.trim() || null,
      expires_at: input.expires_at,
      source: "manual",
      created_by: gate.appUserId,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  revalidatePath("/dashboard/opportunities/manage");
  revalidatePath("/dashboard/opportunities");
  return { id: data.id as string, error: null };
}

export async function updateOpportunity(
  id: string,
  input: OpportunityInput
): Promise<{ error: string | null }> {
  const gate = await requireManageOpportunities();
  if (!gate.ok) return { error: gate.error };

  const title = input.title.trim();
  const link_url = input.link_url.trim();
  if (!title) return { error: "Title is required." };
  if (!link_url) return { error: "Link is required." };

  const { error } = await gate.supabase
    .from("opportunities")
    .update({
      title,
      link_url,
      description: input.description?.trim() || null,
      category: input.category,
      company_name: input.company_name?.trim() || null,
      location: input.location?.trim() || null,
      employment_type: input.employment_type,
      salary: input.salary?.trim() || null,
      expires_at: input.expires_at,
      updated_by: gate.appUserId,
    })
    .eq("id", id);

  if (error) return { error: error.message };
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
  revalidatePath("/dashboard/opportunities/manage");
  revalidatePath("/dashboard/opportunities");
  return { error: null };
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
      source: "csv_import",
      is_active: false,
      category: null,
      created_by: gate.appUserId,
    }))
  );

  if (insertErr) return { inserted: 0, skipped_duplicates: skipped, error: insertErr.message };

  revalidatePath("/dashboard/opportunities/manage");
  return { inserted: toInsert.length, skipped_duplicates: skipped, error: null };
}
