"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { hasAnyPermission, hasPermission, type UserProfile } from "@/lib/types/rbac";
import { revalidatePath } from "next/cache";

export type UsersWithPointsOption = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  total_points: number | null;
};

export type ManagedPointTransactionRow = {
  id: string;
  user_id: string;
  user_name: string;
  category_id: string | null;
  category_name: string;
  points_earned: number | null;
  created_at: string | null;
  created_by: string | null;
};

const PAGE_SIZE_DEFAULT = 20;

function formatUserName(first: string | null, last: string | null) {
  const f = first?.trim() ?? "";
  const l = last?.trim() ?? "";
  const s = `${f} ${l}`.trim();
  return s || "Unknown";
}

function hasViewTransactions(profile: UserProfile | null): boolean {
  return hasAnyPermission(profile, ["view_points", "manage_points"]);
}

type LeaderboardRow = {
  user_id: string;
  total_points: number | null;
};

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type TxRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  points_earned: number | null;
  created_at: string | null;
  created_by: string | null;
};

export async function getUsersWithPointsForManagement(): Promise<{
  data: UsersWithPointsOption[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: authRes, error: authErr } = await supabase.auth.getUser();
  if (authErr) return { data: [], error: authErr.message };
  if (!authRes.user?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authRes.user.id);
  if (!hasAnyPermission(profile, ["view_points", "manage_points"])) {
    return { data: [], error: "You do not have permission to view point transactions." };
  }

  const { data: lbRows, error: lbErr } = await supabase
    .from("leaderboard")
    .select("user_id, total_points")
    .gt("total_points", 0)
    .order("total_points", { ascending: false, nullsFirst: false });

  if (lbErr) return { data: [], error: lbErr.message };

  const leaderboardRows = (lbRows ?? []) as LeaderboardRow[];
  const userIds = leaderboardRows.map((r) => String(r.user_id));
  if (userIds.length === 0) return { data: [], error: null };

  const { data: userRows, error: userErr } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .in("id", userIds);

  if (userErr) return { data: [], error: userErr.message };

  const typedUserRows = (userRows ?? []) as UserRow[];
  const userById = new Map<string, { first_name: string | null; last_name: string | null }>(
    typedUserRows.map((u) => [
      String(u.id),
      { first_name: u.first_name ?? null, last_name: u.last_name ?? null },
    ])
  );

  const rows = leaderboardRows.map((r) => {
    const uid = String(r.user_id);
    const u = userById.get(uid);
    return {
      user_id: uid,
      total_points: (r.total_points as number | null) ?? null,
      first_name: u?.first_name ?? null,
      last_name: u?.last_name ?? null,
    } satisfies UsersWithPointsOption;
  });

  return { data: rows, error: null };
}

export async function getManagedPointTransactionsForUsersWithPoints(
  input: { page?: number; pageSize?: number }
): Promise<{
  data: ManagedPointTransactionRow[];
  totalCount: number;
  error: string | null;
}> {
  const pageSize = input.pageSize ?? PAGE_SIZE_DEFAULT;
  const page = Math.max(0, input.page ?? 0);

  const supabase = await createClient();
  const { data: authRes, error: authErr } = await supabase.auth.getUser();
  if (authErr) return { data: [], totalCount: 0, error: authErr.message };
  if (!authRes.user?.id) return { data: [], totalCount: 0, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authRes.user.id);
  if (!hasViewTransactions(profile)) {
    return {
      data: [],
      totalCount: 0,
      error: "You do not have permission to view point transactions.",
    };
  }

  // Determine the set of users with points via leaderboard totals.
  const { data: lbRows, error: lbErr } = await supabase
    .from("leaderboard")
    .select("user_id, total_points")
    .gt("total_points", 0);
  if (lbErr) return { data: [], totalCount: 0, error: lbErr.message };

  const leaderboardRows = (lbRows ?? []) as LeaderboardRow[];
  const userIds = leaderboardRows.map((r) => String(r.user_id));
  if (userIds.length === 0) return { data: [], totalCount: 0, error: null };

  const start = page * pageSize;
  const end = start + pageSize - 1;

  const { data: txRows, error: txErr, count } = await supabase
    .from("point_transactions")
    .select(
      "id, user_id, category_id, points_earned, created_at, created_by",
      { count: "exact" }
    )
    .in("user_id", userIds)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (txErr) return { data: [], totalCount: 0, error: txErr.message };

  const txData = (txRows ?? []) as TxRow[];
  const ids = new Set<string>(txData.map((r) => String(r.user_id)));
  const catIds = new Set<string>(
    txData
      .map((r) => (r.category_id ? String(r.category_id) : null))
      .filter((v: string | null): v is string => v != null)
  );

  const txUserIds = Array.from(ids);
  const categoryIds = Array.from(catIds);

  const [userRes, catRes] = await Promise.all([
    txUserIds.length
      ? supabase
          .from("users")
          .select("id, first_name, last_name")
          .in("id", txUserIds)
      : Promise.resolve({ data: [], error: null }),
    categoryIds.length
      ? supabase
          .from("point_categories")
          .select("id, name")
          .in("id", categoryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (userRes.error)
    return { data: [], totalCount: 0, error: userRes.error.message };
  if (catRes.error)
    return { data: [], totalCount: 0, error: catRes.error.message };

  const userById = new Map<string, { first_name: string | null; last_name: string | null }>(
    ((userRes.data ?? []) as UserRow[]).map((u) => [
      String(u.id),
      { first_name: u.first_name ?? null, last_name: u.last_name ?? null },
    ])
  );

  const catById = new Map<string, string>(
    ((catRes.data ?? []) as Array<{ id: string; name: string }>).map((c) => [
      String(c.id),
      String(c.name),
    ])
  );

  const rows = txData.map((r) => {
    const uid = String(r.user_id);
    const u = userById.get(uid);
    const user_name = u ? formatUserName(u.first_name, u.last_name) : "Unknown";
    const catId = r.category_id ? String(r.category_id) : null;
    const category_name = catId ? catById.get(catId) ?? "Unknown" : "Unknown";
    return {
      id: String(r.id),
      user_id: uid,
      user_name,
      category_id: catId,
      category_name,
      points_earned: (r.points_earned as number | null) ?? null,
      created_at: (r.created_at as string | null) ?? null,
      created_by: r.created_by ? String(r.created_by) : null,
    } satisfies ManagedPointTransactionRow;
  });

  return { data: rows, totalCount: count ?? 0, error: null };
}

export type CreateIndividualPointTransactionInput = {
  user_id: string;
  category_id: string;
  points_earned: number;
};

export async function createIndividualPointTransactionForUser(
  input: CreateIndividualPointTransactionInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: authRes, error: authErr } = await supabase.auth.getUser();
  if (authErr) return { error: authErr.message };
  if (!authRes.user?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authRes.user.id);
  if (!hasPermission(profile, "manage_points")) {
    return { error: "You do not have permission to manage point transactions." };
  }

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const userId = input.user_id;
  const categoryId = input.category_id;
  const pts = Math.trunc(input.points_earned);

  if (!userId) return { error: "User is required." };
  if (!categoryId) return { error: "Category is required." };
  if (!Number.isFinite(pts)) return { error: "Points must be a number." };

  // Use service role so this insert isn't blocked by RLS policies.
  const admin = getServiceRoleClient();
  if (!admin) return { error: "Missing service role key." };

  const { error } = await admin.from("point_transactions").insert({
    user_id: userId,
    category_id: categoryId,
    points_earned: pts,
    created_by: appUserId,
    updated_by: appUserId,
    updated_on: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/point-management");
  return { error: null };
}

