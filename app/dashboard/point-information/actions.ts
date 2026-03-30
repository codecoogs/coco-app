"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { revalidatePath } from "next/cache";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type PointCategoryRow = {
  id: string;
  name: string;
  points_value: number;
  description: string | null;
};

export async function listPointCategories(): Promise<{
  data: PointCategoryRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { data: [], error: "Not signed in." };
  }

  const { data, error } = await supabase
    .from("point_categories")
    .select("id, name, points_value, description")
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as PointCategoryRow[], error: null };
}

async function requireManagePointCategories(): Promise<
  | { ok: true; supabase: ServerSupabaseClient }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Not signed in." };
  }
  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_point_categories")) {
    return {
      ok: false,
      error: "You do not have permission to manage point categories.",
    };
  }
  return { ok: true, supabase };
}

export async function createPointCategory(input: {
  name: string;
  points_value: number;
  description: string | null;
}): Promise<{ error: string | null }> {
  const gate = await requireManagePointCategories();
  if (!gate.ok) return { error: gate.error };

  const name = input.name.trim();
  if (!name) return { error: "Name is required." };
  if (!Number.isFinite(input.points_value) || input.points_value < 0) {
    return { error: "Points must be a non-negative number." };
  }

  const { error } = await gate.supabase.from("point_categories").insert({
    name,
    points_value: Math.floor(input.points_value),
    description: input.description?.trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/point-information");
  return { error: null };
}

export async function updatePointCategory(
  id: string,
  input: {
    name: string;
    points_value: number;
    description: string | null;
  }
): Promise<{ error: string | null }> {
  const gate = await requireManagePointCategories();
  if (!gate.ok) return { error: gate.error };

  const name = input.name.trim();
  if (!name) return { error: "Name is required." };
  if (!Number.isFinite(input.points_value) || input.points_value < 0) {
    return { error: "Points must be a non-negative number." };
  }

  const { error } = await gate.supabase
    .from("point_categories")
    .update({
      name,
      points_value: Math.floor(input.points_value),
      description: input.description?.trim() || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/point-information");
  return { error: null };
}

export async function deletePointCategory(id: string): Promise<{
  error: string | null;
}> {
  const gate = await requireManagePointCategories();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("point_categories")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/point-information");
  return { error: null };
}
