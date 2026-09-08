"use server";

import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import type { Resource, ResourceInput } from "@/lib/types/resources";
import { hasPermission } from "@/lib/types/rbac";
import { revalidatePath } from "next/cache";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function requireManageResources(): Promise<
  | { ok: true; supabase: ServerSupabaseClient; appUserId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_resources")) {
    return { ok: false, error: "You do not have permission to manage resources." };
  }
  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { ok: false, error: "No profile row for this user." };
  return { ok: true, supabase, appUserId };
}

const RESOURCE_COLUMNS =
  "id, title, description, category, link_url, extension, thumbnail_url, resource_date, display_order, website_viewable, is_active, created_at, updated_at";

// updated_at is stamped by resources_set_updated_at_trg, so mutations only set updated_by.

function revalidate() {
  revalidatePath("/dashboard/events/manage");
}

function normalize(input: ResourceInput) {
  return {
    title: input.title.trim(),
    category: input.category.trim(),
    link_url: input.link_url.trim(),
    description: input.description?.trim() || null,
    extension: input.extension?.trim() || null,
    resource_date: input.resource_date || null,
    website_viewable: input.website_viewable,
  };
}

function validate(input: ResourceInput): string | null {
  if (!input.title.trim()) return "Title is required.";
  if (!input.category.trim()) return "Category is required.";
  if (!input.link_url.trim()) return "Link is required.";
  return null;
}

export async function getResourcesForManage(): Promise<{
  data: Resource[];
  error: string | null;
}> {
  const gate = await requireManageResources();
  if (!gate.ok) return { data: [], error: gate.error };

  const { data, error } = await gate.supabase
    .from("resources")
    .select(RESOURCE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Resource[], error: null };
}

export async function createResource(
  input: ResourceInput
): Promise<{ id: string | null; error: string | null }> {
  const gate = await requireManageResources();
  if (!gate.ok) return { id: null, error: gate.error };

  const invalid = validate(input);
  if (invalid) return { id: null, error: invalid };

  const { data, error } = await gate.supabase
    .from("resources")
    .insert({ ...normalize(input), created_by: gate.appUserId })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  revalidate();
  return { id: data.id as string, error: null };
}

export async function updateResource(
  id: string,
  input: ResourceInput
): Promise<{ error: string | null }> {
  const gate = await requireManageResources();
  if (!gate.ok) return { error: gate.error };

  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const { error } = await gate.supabase
    .from("resources")
    .update({ ...normalize(input), updated_by: gate.appUserId })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidate();
  return { error: null };
}

export async function setResourceActive(
  id: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const gate = await requireManageResources();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("resources")
    .update({ is_active: isActive, updated_by: gate.appUserId })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidate();
  return { error: null };
}

export async function setResourceWebsiteViewable(
  id: string,
  websiteViewable: boolean
): Promise<{ error: string | null }> {
  const gate = await requireManageResources();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("resources")
    .update({ website_viewable: websiteViewable, updated_by: gate.appUserId })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidate();
  return { error: null };
}

export async function deleteResource(id: string): Promise<{ error: string | null }> {
  const gate = await requireManageResources();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from("resources").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidate();
  return { error: null };
}
