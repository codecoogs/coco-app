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
    memberFirstName: null,
  };
}

function sumPointsFromTransactions(
  rows: { points_earned: number | null }[]
): number {
  return rows.reduce((s, t) => s + (Number(t.points_earned) || 0), 0);
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

/**
 * All linked `public.users.id` values for this auth login (matches point-history resolution).
 */
export async function getLinkedAppUserIds(
  supabase: SupabaseClient,
  authUser: { id: string; email?: string | null }
): Promise<string[]> {
  let admin: SupabaseClient | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }
  if (!admin) {
    const appUserId = await getCurrentAppUserId(supabase);
    return appUserId ? [appUserId] : [];
  }
  return resolveUserIdsForPointHistory(admin, authUser.id, authUser.email);
}

async function fetchPointHistoryViaRls(
  supabase: SupabaseClient,
  appUserId: string
): Promise<{ data: PointHistoryBundle; error: string | null }> {
  const [lbRes, txRes, catRes, userRes] = await Promise.all([
    supabase
      .from("leaderboard")
      .select("current_rank")
      .eq("user_id", appUserId)
      .maybeSingle(),
    supabase
      .from("point_transactions")
      .select("id, category_id, points_earned, created_at")
      .eq("user_id", appUserId)
      .order("created_at", { ascending: false }),
    supabase.from("point_categories").select("id, name, points_value").order("name"),
    supabase.from("users").select("first_name").eq("id", appUserId).maybeSingle(),
  ]);

  if (lbRes.error) return { data: emptyBundle(), error: lbRes.error.message };
  if (txRes.error) return { data: emptyBundle(), error: txRes.error.message };
  if (catRes.error) return { data: emptyBundle(), error: catRes.error.message };
  if (userRes.error) return { data: emptyBundle(), error: userRes.error.message };

  const transactions = (txRes.data ?? []) as PointHistoryTransaction[];
  const fn = userRes.data?.first_name?.trim() ?? null;

  return {
    data: {
      totalPoints: sumPointsFromTransactions(transactions),
      rank: lbRes.data?.current_rank ?? null,
      transactions,
      categories: (catRes.data ?? []) as PointHistoryCategory[],
      memberFirstName: fn || null,
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
    admin.from("leaderboard").select("user_id, current_rank").in("user_id", userIds),
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

  const { data: userRows, error: userErr } = await admin
    .from("users")
    .select("first_name")
    .in("id", userIds);

  if (userErr) {
    return { data: emptyBundle(), error: userErr.message, hasLinkedProfile: true };
  }

  const memberFirstName =
    userRows?.find((r) => r.first_name?.trim())?.first_name?.trim() ?? null;

  const transactions = (txRes.data ?? []) as PointHistoryTransaction[];
  const totalPoints = sumPointsFromTransactions(transactions);

  const lbRows = lbRes.data ?? [];
  const ranks = lbRows
    .map((r) => r.current_rank)
    .filter((n): n is number => n != null && Number.isFinite(n));
  const rank = ranks.length > 0 ? Math.min(...ranks) : null;

  return {
    data: {
      totalPoints,
      rank,
      transactions,
      categories: (catRes.data ?? []) as PointHistoryCategory[],
      memberFirstName,
    },
    error: null,
    hasLinkedProfile: true,
  };
}
