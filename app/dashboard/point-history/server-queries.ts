import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PointHistoryBundle,
  PointHistoryCategory,
  PointHistoryTransaction,
} from "./queries";

function emptyBundle(): PointHistoryBundle {
  return {
    totalPoints: 0,
    rank: null,
    transactions: [],
    categories: [],
  };
}

/**
 * All public.users.id rows that belong to this login (auth user id + same email).
 * Handles legacy data where points reference a profile row that predates auth_id linking.
 */
async function resolveUserIdsForPointHistory(
  admin: SupabaseClient,
  authId: string,
  email: string | null | undefined
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: byAuth } = await admin.from("users").select("id").eq("auth_id", authId);
  for (const r of byAuth ?? []) {
    if (r.id) ids.add(String(r.id));
  }

  const normalized = email?.trim();
  if (normalized) {
    const { data: exact } = await admin.from("users").select("id").eq("email", normalized);
    for (const r of exact ?? []) {
      if (r.id) ids.add(String(r.id));
    }
    if (!exact?.length) {
      const safe = normalized.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
      const { data: fuzzy } = await admin.from("users").select("id").ilike("email", safe);
      for (const r of fuzzy ?? []) {
        if (r.id) ids.add(String(r.id));
      }
    }
  }

  return [...ids];
}

async function fetchPointHistoryViaRls(
  supabase: SupabaseClient,
  appUserId: string
): Promise<{ data: PointHistoryBundle; error: string | null }> {
  const [lbRes, txRes, catRes] = await Promise.all([
    supabase
      .from("leaderboard")
      .select("total_points, current_rank")
      .eq("user_id", appUserId)
      .maybeSingle(),
    supabase
      .from("point_transactions")
      .select("id, category_id, points_earned, created_at")
      .eq("user_id", appUserId)
      .order("created_at", { ascending: false }),
    supabase.from("point_categories").select("id, name, points_value").order("name"),
  ]);

  if (lbRes.error) return { data: emptyBundle(), error: lbRes.error.message };
  if (txRes.error) return { data: emptyBundle(), error: txRes.error.message };
  if (catRes.error) return { data: emptyBundle(), error: catRes.error.message };

  return {
    data: {
      totalPoints: lbRes.data?.total_points ?? 0,
      rank: lbRes.data?.current_rank ?? null,
      transactions: (txRes.data ?? []) as PointHistoryTransaction[],
      categories: (catRes.data ?? []) as PointHistoryCategory[],
    },
    error: null,
  };
}

export type PointHistoryFetchResult = {
  data: PointHistoryBundle;
  error: string | null;
  /** False when no public.users row matches this login (auth_id or email). */
  hasLinkedProfile: boolean;
};

/**
 * Load point history for the signed-in user. Prefers service-role resolution so rows
 * tied to any matching public.users profile (auth_id or email) are included.
 */
export async function fetchPointHistoryForSignedInUser(
  supabase: SupabaseClient,
  authUser: { id: string; email?: string | null }
): Promise<PointHistoryFetchResult> {
  let admin: SupabaseClient | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  if (!admin) {
    const appUserId = await getCurrentAppUserId(supabase);
    if (!appUserId) {
      return { data: emptyBundle(), error: null, hasLinkedProfile: false };
    }
    const r = await fetchPointHistoryViaRls(supabase, appUserId);
    return { ...r, hasLinkedProfile: true };
  }

  const userIds = await resolveUserIdsForPointHistory(
    admin,
    authUser.id,
    authUser.email
  );

  if (userIds.length === 0) {
    return { data: emptyBundle(), error: null, hasLinkedProfile: false };
  }

  const [txRes, lbRes, catRes] = await Promise.all([
    admin
      .from("point_transactions")
      .select("id, category_id, points_earned, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),
    admin.from("leaderboard").select("user_id, total_points, current_rank").in("user_id", userIds),
    supabase.from("point_categories").select("id, name, points_value").order("name"),
  ]);

  if (txRes.error) {
    return { data: emptyBundle(), error: txRes.error.message, hasLinkedProfile: true };
  }
  if (lbRes.error) {
    return { data: emptyBundle(), error: lbRes.error.message, hasLinkedProfile: true };
  }
  if (catRes.error) {
    return { data: emptyBundle(), error: catRes.error.message, hasLinkedProfile: true };
  }

  const lbRows = lbRes.data ?? [];
  const totalPoints = lbRows.reduce((s, r) => s + (r.total_points ?? 0), 0);
  const ranks = lbRows
    .map((r) => r.current_rank)
    .filter((n): n is number => n != null && Number.isFinite(n));
  const rank = ranks.length > 0 ? Math.min(...ranks) : null;

  return {
    data: {
      totalPoints,
      rank,
      transactions: (txRes.data ?? []) as PointHistoryTransaction[],
      categories: (catRes.data ?? []) as PointHistoryCategory[],
    },
    error: null,
    hasLinkedProfile: true,
  };
}
