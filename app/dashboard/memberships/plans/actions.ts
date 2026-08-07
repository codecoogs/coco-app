"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { hasPermission } from "@/lib/types/rbac";
import type {
  AcademicYear,
  AcademicYearInput,
  MembershipPlanInput,
  MembershipPlanWithPeriod,
  Semester,
  SemesterInput,
} from "@/lib/types/membership";
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

async function requireManageMembershipsWithAppUser(): Promise<
  | { ok: true; supabase: ServerSupabaseClient; appUserId: string }
  | { ok: false; error: string }
> {
  const auth = await requireManageMemberships();
  if (!auth.ok) return auth;

  const appUserId = await getCurrentAppUserId(auth.supabase);
  if (!appUserId) return { ok: false, error: "No profile row for this user." };
  return { ok: true, supabase: auth.supabase, appUserId };
}

export async function getMembershipPlansForManage(): Promise<{
  data: MembershipPlanWithPeriod[];
  error: string | null;
}> {
  const auth = await requireManageMemberships();
  if (!auth.ok) return { data: [], error: auth.error };
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("membership_plans")
    .select(
      "id, name, kind, stripe_price_id, amount_cents, semester_id, academic_year_id, is_active, created_at, updated_at"
    )
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  if (!data?.length) return { data: [], error: null };

  const semesterIds = [...new Set(data.map((p) => p.semester_id).filter(Boolean))] as string[];
  const academicYearIds = [
    ...new Set(data.map((p) => p.academic_year_id).filter(Boolean)),
  ] as string[];

  const [{ data: semesters }, { data: academicYears }] = await Promise.all([
    semesterIds.length
      ? supabase.from("semesters").select("id, label, start_date, end_date").in("id", semesterIds)
      : Promise.resolve({ data: [] as { id: string; label: string; start_date: string; end_date: string }[] }),
    academicYearIds.length
      ? supabase.from("academic_years").select("id, label, start_date, end_date").in("id", academicYearIds)
      : Promise.resolve({ data: [] as { id: string; label: string; start_date: string; end_date: string }[] }),
  ]);

  const semesterMap = new Map((semesters ?? []).map((s) => [s.id, s]));
  const yearMap = new Map((academicYears ?? []).map((y) => [y.id, y]));

  const result: MembershipPlanWithPeriod[] = data.map((p) => {
    const period =
      p.kind === "semester"
        ? semesterMap.get(p.semester_id ?? "")
        : yearMap.get(p.academic_year_id ?? "");
    return {
      ...p,
      period_label: period?.label ?? "Unknown period",
      starts_at: period?.start_date ?? "",
      ends_at: period?.end_date ?? "",
    };
  });

  return { data: result, error: null };
}

/** Options for the plan form's period picker, and the source data for the Academic periods tab. */
export async function getPeriodOptions(): Promise<{
  semesters: Semester[];
  academicYears: AcademicYear[];
  error: string | null;
}> {
  const auth = await requireManageMemberships();
  if (!auth.ok) return { semesters: [], academicYears: [], error: auth.error };
  const { supabase } = auth;

  const [{ data: semesters, error: semErr }, { data: academicYears, error: ayErr }] =
    await Promise.all([
      supabase
        .from("semesters")
        .select("id, academic_year_id, label, term, start_date, end_date, is_current")
        .order("start_date", { ascending: false }),
      supabase
        .from("academic_years")
        .select("id, label, is_current, start_date, end_date")
        .order("start_date", { ascending: false }),
    ]);

  if (semErr) return { semesters: [], academicYears: [], error: semErr.message };
  if (ayErr) return { semesters: [], academicYears: [], error: ayErr.message };

  return { semesters: semesters ?? [], academicYears: academicYears ?? [], error: null };
}

export async function createMembershipPlan(
  input: MembershipPlanInput
): Promise<{ error: string | null }> {
  const auth = await requireManageMemberships();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase.from("membership_plans").insert(input);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/memberships/plans");
  revalidatePath("/dashboard/membership");
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
  revalidatePath("/dashboard/membership");
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
  revalidatePath("/dashboard/membership");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Academic years
// ---------------------------------------------------------------------------

export async function createAcademicYear(
  input: AcademicYearInput
): Promise<{ error: string | null }> {
  const auth = await requireManageMembershipsWithAppUser();
  if (!auth.ok) return { error: auth.error };
  const { supabase, appUserId } = auth;

  if (input.is_current) {
    const { error: clearError } = await supabase
      .from("academic_years")
      .update({ is_current: false })
      .eq("is_current", true);
    if (clearError) return { error: clearError.message };
  }

  const { error } = await supabase
    .from("academic_years")
    .insert({ ...input, created_by: appUserId, updated_by: appUserId });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/memberships/plans");
  return { error: null };
}

export async function updateAcademicYear(
  id: string,
  input: AcademicYearInput
): Promise<{ error: string | null }> {
  const auth = await requireManageMembershipsWithAppUser();
  if (!auth.ok) return { error: auth.error };
  const { supabase, appUserId } = auth;

  if (input.is_current) {
    const { error: clearError } = await supabase
      .from("academic_years")
      .update({ is_current: false })
      .eq("is_current", true)
      .neq("id", id);
    if (clearError) return { error: clearError.message };
  }

  const { error } = await supabase
    .from("academic_years")
    .update({ ...input, updated_by: appUserId })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/memberships/plans");
  return { error: null };
}

export async function deleteAcademicYear(id: string): Promise<{ error: string | null }> {
  const auth = await requireManageMemberships();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase.from("academic_years").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/memberships/plans");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Semesters
// ---------------------------------------------------------------------------

export async function createSemester(
  input: SemesterInput
): Promise<{ error: string | null }> {
  const auth = await requireManageMembershipsWithAppUser();
  if (!auth.ok) return { error: auth.error };
  const { supabase, appUserId } = auth;

  if (input.is_current) {
    const { error: clearError } = await supabase
      .from("semesters")
      .update({ is_current: false })
      .eq("is_current", true);
    if (clearError) return { error: clearError.message };
  }

  const { error } = await supabase
    .from("semesters")
    .insert({ ...input, created_by: appUserId, updated_by: appUserId });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/memberships/plans");
  return { error: null };
}

export async function updateSemester(
  id: string,
  input: SemesterInput
): Promise<{ error: string | null }> {
  const auth = await requireManageMembershipsWithAppUser();
  if (!auth.ok) return { error: auth.error };
  const { supabase, appUserId } = auth;

  if (input.is_current) {
    const { error: clearError } = await supabase
      .from("semesters")
      .update({ is_current: false })
      .eq("is_current", true)
      .neq("id", id);
    if (clearError) return { error: clearError.message };
  }

  const { error } = await supabase
    .from("semesters")
    .update({ ...input, updated_by: appUserId })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/memberships/plans");
  return { error: null };
}

export async function deleteSemester(id: string): Promise<{ error: string | null }> {
  const auth = await requireManageMemberships();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase.from("semesters").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/memberships/plans");
  return { error: null };
}
