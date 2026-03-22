"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/types/rbac";
import { revalidatePath } from "next/cache";

export type OfficerRow = {
  id: string;
  user_id: string;
  positionTitle: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
};

export type PositionTitleOption = { title: string };

/** List all officer assignments (user_positions) with user display info. Requires view_officers or is_admin. */
export async function getOfficers(): Promise<
  { data: OfficerRow[]; error: string | null }
> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) {
    return { data: [], error: "Not signed in." };
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "view_officers")) {
    return { data: [], error: "You do not have permission to view officers." };
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("user_positions")
    .select(
      "id, user_id, positionTitle, is_active, created_at, updated_at, created_by, updated_by"
    )
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  if (!rows?.length) return { data: [], error: null };

  const userIds = [...new Set((rows as { user_id: string }[]).map((r) => r.user_id))];
  const { data: users } = await admin
    .from("users")
    .select("id, email, first_name, last_name")
    .in("id", userIds);

  const userMap = new Map(
    (users ?? []).map((u) => [
      u.id,
      {
        email: u.email ?? null,
        first_name: u.first_name ?? null,
        last_name: u.last_name ?? null,
      },
    ])
  );

  const data: OfficerRow[] = (rows as OfficerRow[]).map((r) => {
    const u = userMap.get(r.user_id);
    return {
      ...r,
      user_email: u?.email ?? null,
      user_first_name: u?.first_name ?? null,
      user_last_name: u?.last_name ?? null,
    };
  });

  return { data, error: null };
}

/** List position titles for dropdowns. */
export async function getPositionTitles(): Promise<
  { data: PositionTitleOption[]; error: string | null }
> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_officers")) {
    return { data: [], error: "No permission." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("positions")
    .select("title")
    .eq("is_active", true)
    .order("title");

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => ({ title: r.title })),
    error: null,
  };
}

/** Users that do not yet have a position (for "Add officer" form). */
export async function getUsersWithoutPosition(): Promise<
  { data: { id: string; email: string; first_name: string; last_name: string }[]; error: string | null }
> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_officers")) {
    return { data: [], error: "No permission." };
  }

  const admin = createAdminClient();
  const { data: assigned } = await admin
    .from("user_positions")
    .select("user_id");
  const assignedIds = new Set((assigned ?? []).map((r) => r.user_id));

  const { data: users, error } = await admin
    .from("users")
    .select("id, email, first_name, last_name");

  if (error) return { data: [], error: error.message };

  const unassigned = (users ?? []).filter((u) => !assignedIds.has(u.id));
  return {
    data: unassigned.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
    })),
    error: null,
  };
}

/** Create an officer assignment. Sets created_by and updated_by to current app user id (users.id). */
export async function createOfficer(
  user_id: string,
  positionTitle: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_officers")) {
    return { error: "You do not have permission to manage officers." };
  }

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const admin = createAdminClient();
  const { error } = await admin.from("user_positions").insert({
    user_id,
    positionTitle: positionTitle || null,
    is_active: true,
    created_by: appUserId,
    updated_by: appUserId,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/officers");
  return { error: null };
}

/** Update an officer assignment. Sets updated_by to current app user id (users.id). */
export async function updateOfficer(
  id: string,
  updates: { positionTitle?: string; is_active?: boolean }
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_officers")) {
    return { error: "You do not have permission to manage officers." };
  }

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const payload: Record<string, unknown> = { updated_by: appUserId };
  if (updates.positionTitle !== undefined) payload.positionTitle = updates.positionTitle;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_positions")
    .update(payload)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/officers");
  return { error: null };
}

/** Set is_active to false. Sets updated_by to current app user id (users.id). */
export async function deactivateOfficer(id: string): Promise<{ error: string | null }> {
  return updateOfficer(id, { is_active: false });
}
