"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import type { MembershipPlan, MembershipPlanInput } from "@/lib/types/membership";
import { revalidatePath } from "next/cache";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function requireManageMemberships(): Promise<
  | { ok: true; supabase: ServerSupabaseClient }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_memberships")) {
    return { ok: false, error: "You do not have permission to manage membership plans." };
  }
  return { ok: true, supabase };
}

export async function getMembershipPlansForManage(): Promise<{
  data: MembershipPlan[];
  error: string | null;
}> {
  const auth = await requireManageMemberships();
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await auth.supabase
    .from("membership_plans")
    .select(
      "id, name, kind, stripe_price_id, amount_cents, starts_at, ends_at, is_active, created_at, updated_at"
    )
    .order("starts_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function createMembershipPlan(
  input: MembershipPlanInput
): Promise<{ error: string | null }> {
  const auth = await requireManageMemberships();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase.from("membership_plans").insert(input);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/memberships/plans");
  revalidatePath("/dashboard/settings");
  return { error: null };
}

export async function updateMembershipPlan(
  id: string,
  input: MembershipPlanInput
): Promise<{ error: string | null }> {
  const auth = await requireManageMemberships();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase.from("membership_plans").update(input).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/memberships/plans");
  revalidatePath("/dashboard/settings");
  return { error: null };
}

export async function setMembershipPlanActive(
  id: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const auth = await requireManageMemberships();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase
    .from("membership_plans")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/memberships/plans");
  revalidatePath("/dashboard/settings");
  return { error: null };
}
