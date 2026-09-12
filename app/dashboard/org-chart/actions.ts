"use server";

import { findLoopedNodeIds, type ChartNode } from "@/lib/org-chart/tree";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, type PermissionName } from "@/lib/types/rbac";
import { revalidatePath } from "next/cache";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const ORG_CHART_PATH = "/dashboard/org-chart";

async function requirePositionPermission(permission: PermissionName): Promise<
  | { ok: true; supabase: ServerSupabaseClient; appUserId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, permission)) {
    return { ok: false, error: "You do not have permission to do that." };
  }

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { ok: false, error: "No profile row for this user." };

  return { ok: true, supabase, appUserId };
}

export type OrgChartNode = ChartNode & {
  branchName: string | null;
  holders: string[];
  isAdmin: boolean;
  isActive: boolean;
};

export type OrgChartChange = {
  id: number;
  parentId: number | null;
  x: number;
  y: number;
};

export async function getOrgChart(): Promise<{
  data: OrgChartNode[];
  error: string | null;
}> {
  const gate = await requirePositionPermission("view_positions");
  if (!gate.ok) return { data: [], error: gate.error };
  const { supabase } = gate;

  const [positionsRes, branchesRes, assignmentsRes] = await Promise.all([
    supabase
      .from("positions")
      .select("id, title, parent_position_id, canvas_x, canvas_y, is_admin, is_active, branch_id")
      .order("title", { ascending: true }),
    supabase.from("branches").select("id, name"),
    supabase.from("user_positions").select("positionTitle, user_id").eq("is_active", true),
  ]);

  const failure = positionsRes.error ?? branchesRes.error ?? assignmentsRes.error;
  if (failure) return { data: [], error: failure.message };

  const assignments = (assignmentsRes.data ?? []) as {
    positionTitle: string | null;
    user_id: string;
  }[];
  const holderIds = [...new Set(assignments.map((a) => a.user_id))];

  const { data: people } = holderIds.length
    ? await supabase.from("users").select("id, first_name, last_name").in("id", holderIds)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null }[] };

  const nameById = new Map(
    (people ?? []).map((p) => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Someone",
    ])
  );

  const holdersByTitle = new Map<string, string[]>();
  for (const assignment of assignments) {
    if (!assignment.positionTitle) continue;
    const list = holdersByTitle.get(assignment.positionTitle) ?? [];
    const name = nameById.get(assignment.user_id);
    if (name) list.push(name);
    holdersByTitle.set(assignment.positionTitle, list);
  }

  const branchName = new Map(
    ((branchesRes.data ?? []) as { id: number; name: string }[]).map((b) => [b.id, b.name])
  );

  type Row = {
    id: number;
    title: string;
    parent_position_id: number | null;
    canvas_x: number | null;
    canvas_y: number | null;
    is_admin: boolean;
    is_active: boolean;
    branch_id: number | null;
  };

  const data: OrgChartNode[] = ((positionsRes.data ?? []) as Row[]).map((row) => ({
    id: row.id,
    title: row.title,
    parentId: row.parent_position_id,
    x: row.canvas_x,
    y: row.canvas_y,
    branchName: row.branch_id ? (branchName.get(row.branch_id) ?? null) : null,
    holders: holdersByTitle.get(row.title) ?? [],
    isAdmin: row.is_admin,
    isActive: row.is_active,
  }));

  return { data, error: null };
}

/**
 * Writes the arrangement and the reporting lines in one go.
 *
 * The whole chart is re-checked for loops before anything is written, not just
 * the rows that moved: current_user_can_assign_to() walks these links to decide
 * who may hand work to whom, so a loop would make that question unanswerable.
 * The canvas already refuses to draw one, but this is what makes it true.
 */
export async function saveOrgChart(
  changes: OrgChartChange[]
): Promise<{ error: string | null; saved: number }> {
  const gate = await requirePositionPermission("manage_positions");
  if (!gate.ok) return { error: gate.error, saved: 0 };
  const { supabase, appUserId } = gate;

  if (!changes.length) return { error: null, saved: 0 };

  const { data: current, error: readError } = await supabase
    .from("positions")
    .select("id, title, parent_position_id");
  if (readError) return { error: readError.message, saved: 0 };

  const changeById = new Map(changes.map((c) => [c.id, c]));
  const merged: ChartNode[] = (
    (current ?? []) as { id: number; title: string; parent_position_id: number | null }[]
  ).map((row) => ({
    id: row.id,
    title: row.title,
    parentId: changeById.has(row.id)
      ? (changeById.get(row.id)!.parentId ?? null)
      : row.parent_position_id,
    x: null,
    y: null,
  }));

  const looped = findLoopedNodeIds(merged);
  if (looped.length) {
    const titles = merged
      .filter((n) => looped.includes(n.id))
      .map((n) => n.title)
      .join(", ");
    return { error: `That would make a reporting loop: ${titles}.`, saved: 0 };
  }

  const results = await Promise.all(
    changes.map((change) =>
      supabase
        .from("positions")
        .update({
          parent_position_id: change.parentId,
          canvas_x: change.x,
          canvas_y: change.y,
          updated_by: appUserId,
        })
        .eq("id", change.id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message, saved: 0 };

  revalidatePath(ORG_CHART_PATH);
  return { error: null, saved: changes.length };
}
