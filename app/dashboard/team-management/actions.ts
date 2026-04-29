"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import {
  hasAnyPermission,
  hasPermission,
  type UserProfile,
} from "@/lib/types/rbac";
import { revalidatePath } from "next/cache";

const SERVICE_ROLE_ERROR =
  "SUPABASE_SERVICE_ROLE_KEY is not set on the server. Team management needs the service role key.";
const TEAM_PATH = "/dashboard/team-management";
const TEAM_IMAGES_BUCKET = "assets";
const TEAM_IMAGES_PREFIX = "team-images";
const MAX_TEAM_IMAGE_BYTES = 6 * 1024 * 1024;

function revalidateTeamPages() {
  revalidatePath(TEAM_PATH);
  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/my-team");
}

function assertViewTeams(profile: UserProfile | null): string | null {
  if (
    !hasAnyPermission(profile, ["view_officers", "manage_officers", "manage_teams"])
  ) {
    return "No permission.";
  }
  return null;
}

function assertManageTeams(profile: UserProfile | null): string | null {
  if (
    !hasPermission(profile, "manage_officers") &&
    !hasPermission(profile, "manage_teams")
  ) {
    return "You need team management permission to change teams.";
  }
  return null;
}

export type AcademicYearOption = {
  id: string;
  label: string;
  is_current: boolean | null;
};

export async function getAcademicYearsForSelect(): Promise<{
  data: AcademicYearOption[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertViewTeams(profile);
  if (denied) return { data: [], error: denied };

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const { data, error } = await admin
    .from("academic_years")
    .select("id, label, is_current")
    .order("label");

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []) as AcademicYearOption[],
    error: null,
  };
}

export type TeamManageRow = {
  id: string;
  name: string;
  team_number: number;
  description: string | null;
  team_image_url: string | null;
  academic_year: string | null;
  academic_year_label: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function getTeamsForManage(): Promise<{
  data: TeamManageRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertViewTeams(profile);
  if (denied) return { data: [], error: denied };

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const { data: rows, error } = await admin
    .from("teams")
    .select(
      "id, name, team_number, description, team_image_url, academic_year, created_at, updated_at"
    )
    .order("team_number", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error: error.message };
  const list = (rows ?? []) as Record<string, unknown>[];

  const ayIds = [
    ...new Set(
      list
        .map((r) => r.academic_year as string | null | undefined)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];
  let yearLabels = new Map<string, string>();
  if (ayIds.length > 0) {
    const { data: yrs } = await admin
      .from("academic_years")
      .select("id, label")
      .in("id", ayIds);
    yearLabels = new Map((yrs ?? []).map((y) => [y.id as string, String(y.label)]));
  }

  const data: TeamManageRow[] = list.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    team_number: Number(r.team_number ?? 0),
    description:
      typeof r.description === "string"
        ? r.description
        : r.description === null || r.description === undefined
          ? null
          : String(r.description),
    team_image_url:
      typeof r.team_image_url === "string"
        ? r.team_image_url
        : r.team_image_url
          ? String(r.team_image_url)
          : null,
    academic_year:
      typeof r.academic_year === "string"
        ? r.academic_year
        : r.academic_year
          ? String(r.academic_year)
          : null,
    academic_year_label: (() => {
      const ay = typeof r.academic_year === "string" ? r.academic_year : null;
      return ay ? yearLabels.get(ay) ?? null : null;
    })(),
    created_at: typeof r.created_at === "string" ? r.created_at : null,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : null,
  }));

  return { data, error: null };
}

export async function createTeam(input: {
  name: string;
  team_number: number;
  description: string | null;
  academic_year: string | null;
}): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in.", id: null };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { error: denied, id: null };

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account.", id: null };

  const name = input.name.trim();
  if (!name) return { error: "Team name is required.", id: null };

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR, id: null };

  const now = new Date().toISOString();

  const insertRow: Record<string, unknown> = {
    name,
    team_number: Math.floor(Number(input.team_number)) || 0,
    description: input.description?.trim() || null,
    academic_year: input.academic_year || null,
    created_by: appUserId,
    updated_by: appUserId,
    created_at: now,
    updated_at: now,
  };

  let insertedId: string | null = null;
  let { data: inserted, error } = await admin
    .from("teams")
    .insert(insertRow)
    .select("id")
    .maybeSingle();
  if (
    error &&
    (error.message.includes("points") ||
      error.message.toLowerCase().includes("not null constraint"))
  ) {
    ({ data: inserted, error } = await admin
      .from("teams")
      .insert({ ...insertRow, points: 0 })
      .select("id")
      .maybeSingle());
  }
  if (error) return { error: error.message, id: null };
  insertedId = inserted?.id ? String(inserted.id) : null;

  revalidateTeamPages();
  return { error: null, id: insertedId };
}

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "img";
}

function isAllowedTeamImageMime(mime: string): boolean {
  return mime === "image/jpeg" || mime === "image/png" || mime === "image/webp";
}

function storagePathFromAssetsPublicUrl(publicUrl: string): string | null {
  const needle = `/object/public/${TEAM_IMAGES_BUCKET}/`;
  const i = publicUrl.indexOf(needle);
  if (i === -1) return null;
  try {
    return decodeURIComponent(publicUrl.slice(i + needle.length));
  } catch {
    return null;
  }
}

export async function uploadTeamImageForManage(formData: FormData): Promise<{
  error: string | null;
  teamImageUrl: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in.", teamImageUrl: null };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { error: denied, teamImageUrl: null };

  const teamId = String(formData.get("team_id") ?? "").trim();
  const file = formData.get("file");
  if (!teamId) return { error: "Missing team id.", teamImageUrl: null };
  if (!(file instanceof File) || file.size < 1) {
    return { error: "No image file selected.", teamImageUrl: null };
  }
  if (!isAllowedTeamImageMime(file.type)) {
    return { error: "Use a JPEG, PNG, or WebP image.", teamImageUrl: null };
  }
  if (file.size > MAX_TEAM_IMAGE_BYTES) {
    return { error: "Team image is too large (max 6MB).", teamImageUrl: null };
  }

  const { data: current, error: curErr } = await supabase
    .from("teams")
    .select("team_image_url")
    .eq("id", teamId)
    .maybeSingle();
  if (curErr) return { error: curErr.message, teamImageUrl: null };

  const ext = extFromMime(file.type);
  const path = `${TEAM_IMAGES_PREFIX}/${teamId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const body = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from(TEAM_IMAGES_BUCKET).upload(path, body, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return { error: upErr.message, teamImageUrl: null };

  const { data: pub } = supabase.storage.from(TEAM_IMAGES_BUCKET).getPublicUrl(path);
  const teamImageUrl = pub.publicUrl;

  const { error: writeErr } = await supabase
    .from("teams")
    .update({ team_image_url: teamImageUrl, updated_at: new Date().toISOString() })
    .eq("id", teamId);
  if (writeErr) return { error: writeErr.message, teamImageUrl: null };

  if (current?.team_image_url) {
    const oldPath = storagePathFromAssetsPublicUrl(String(current.team_image_url));
    if (oldPath && oldPath !== path) {
      await supabase.storage.from(TEAM_IMAGES_BUCKET).remove([oldPath]);
    }
  }

  revalidateTeamPages();
  return { error: null, teamImageUrl };
}

export async function clearTeamImageForManage(teamId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { error: denied };

  const { data: current, error: curErr } = await supabase
    .from("teams")
    .select("team_image_url")
    .eq("id", teamId)
    .maybeSingle();
  if (curErr) return { error: curErr.message };

  const { error } = await supabase
    .from("teams")
    .update({ team_image_url: null, updated_at: new Date().toISOString() })
    .eq("id", teamId);
  if (error) return { error: error.message };

  if (current?.team_image_url) {
    const oldPath = storagePathFromAssetsPublicUrl(String(current.team_image_url));
    if (oldPath) {
      await supabase.storage.from(TEAM_IMAGES_BUCKET).remove([oldPath]);
    }
  }

  revalidateTeamPages();
  return { error: null };
}

export async function updateTeam(
  id: string,
  updates: {
    name: string;
    team_number: number;
    description: string | null;
    academic_year: string | null;
  }
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { error: denied };

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const trimmed = updates.name.trim();
  if (!trimmed) return { error: "Team name is required." };

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("teams")
    .update({
      name: trimmed,
      team_number: Math.floor(Number(updates.team_number)) || 0,
      description: updates.description?.trim() || null,
      academic_year: updates.academic_year || null,
      updated_by: appUserId,
      updated_at: now,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidateTeamPages();
  return { error: null };
}

export async function deleteTeam(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { error: denied };

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR };

  await admin.from("teams_leads").delete().eq("team_id", id);
  await admin.from("teams_members").delete().eq("team_id", id);
  const { error } = await admin.from("teams").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidateTeamPages();
  return { error: null };
}

export type TeamLeadManageRow = {
  team_id: string;
  user_id: string;
  updated_at: string | null;
  team_name: string;
  /** Display */
  display_name: string;
  email: string;
};

export async function getTeamLeadsForManage(): Promise<{
  data: TeamLeadManageRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertViewTeams(profile);
  if (denied) return { data: [], error: denied };

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const { data: rows, error } = await admin
    .from("teams_leads")
    .select("team_id, user_id, updated_at");

  if (error) return { data: [], error: error.message };

  const tl = rows ?? [];
  if (tl.length === 0) return { data: [], error: null };

  const teamIds = [...new Set(tl.map((r) => r.team_id).filter(Boolean))] as string[];
  const userIds = [...new Set(tl.map((r) => r.user_id).filter(Boolean))] as string[];

  const [{ data: teams }, { data: users }] = await Promise.all([
    admin.from("teams").select("id, name").in("id", teamIds),
    admin.from("users").select("id, email, first_name, last_name").in("id", userIds),
  ]);

  const teamMap = new Map((teams ?? []).map((t) => [String(t.id), String(t.name ?? "")]));
  const userMap = new Map(
    (users ?? []).map((u) => [
      String(u.id),
      {
        email: String(u.email ?? ""),
        first_name: typeof u.first_name === "string" ? u.first_name : "",
        last_name: typeof u.last_name === "string" ? u.last_name : "",
      },
    ])
  );

  const data: TeamLeadManageRow[] = tl.map((r) => {
    const uid = String(r.user_id);
    const u = userMap.get(uid);
    const first = u?.first_name?.trim() ?? "";
    const last = u?.last_name?.trim() ?? "";
    const name = [first, last].filter(Boolean).join(" ");
    const email = u?.email ?? "";
    return {
      team_id: String(r.team_id),
      user_id: uid,
      updated_at:
        typeof r.updated_at === "string"
          ? r.updated_at
          : r.updated_at
            ? String(r.updated_at)
            : null,
      team_name: teamMap.get(String(r.team_id)) ?? "(unknown team)",
      display_name: name || email || "—",
      email,
    };
  });

  return { data, error: null };
}

export async function getUsersForLeadPicker(): Promise<{
  data: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    discord: string;
  }[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { data: [], error: denied };

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const { data, error } = await admin
    .from("users")
    .select("id, email, first_name, last_name, discord")
    .order("email", { ascending: true })
    .limit(800);

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((u) => ({
      id: String(u.id),
      email: u.email ?? "",
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
      discord: typeof u.discord === "string" ? u.discord : "",
    })),
    error: null,
  };
}

/** One lead per team (teams_leads_pkey is team_id). */
export async function upsertTeamLead(
  team_id: string,
  user_id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { error: denied };

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR };

  const now = new Date().toISOString();

  const { error } = await admin.from("teams_leads").upsert(
    {
      team_id,
      user_id,
      updated_by: appUserId,
      created_by: appUserId,
      created_at: now,
      updated_at: now,
    },
    { onConflict: "team_id" }
  );

  if (error) return { error: error.message };

  revalidateTeamPages();
  return { error: null };
}

export async function removeTeamLead(team_id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { error: denied };

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR };

  const { error } = await admin.from("teams_leads").delete().eq("team_id", team_id);

  if (error) return { error: error.message };

  revalidateTeamPages();
  return { error: null };
}

/** teams_members roster; unique(users.id) ⇒ at most one team per chapter member. */
export type TeamMemberRow = {
  team_id: string;
  team_name: string;
  user_id: string;
  email: string;
  /** From `users.discord` — handle/username or Discord id string. */
  discord: string;
  display_name: string;
  updated_at: string | null;
  created_at: string | null;
};

export async function getTeamMembersForManage(): Promise<{
  data: TeamMemberRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertViewTeams(profile);
  if (denied) return { data: [], error: denied };

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const { data: tm, error } = await admin
    .from("teams_members")
    .select("team_id, user_id, updated_at, created_at");

  if (error) return { data: [], error: error.message };
  const rows = tm ?? [];
  if (rows.length === 0) return { data: [], error: null };

  const teamIds = [...new Set(rows.map((r) => r.team_id).filter(Boolean))] as string[];
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];

  const [{ data: teams }, { data: users }] = await Promise.all([
    admin.from("teams").select("id, name").in("id", teamIds),
    admin.from("users").select("id, email, first_name, last_name, discord").in("id", userIds),
  ]);

  const teamMap = new Map((teams ?? []).map((t) => [String(t.id), String(t.name ?? "")]));
  const userMap = new Map(
    (users ?? []).map((u) => [
      String(u.id),
      {
        email: String(u.email ?? ""),
        discord:
          typeof u.discord === "string" ? u.discord : u.discord != null ? String(u.discord) : "",
        first_name: typeof u.first_name === "string" ? u.first_name : "",
        last_name: typeof u.last_name === "string" ? u.last_name : "",
      },
    ])
  );

  const data: TeamMemberRow[] = rows.map((r) => {
    const uid = String(r.user_id);
    const tid = String(r.team_id);
    const u = userMap.get(uid);
    const first = u?.first_name?.trim() ?? "";
    const last = u?.last_name?.trim() ?? "";
    const name = [first, last].filter(Boolean).join(" ");
    return {
      team_id: tid,
      team_name: teamMap.get(tid) ?? "(unknown)",
      user_id: uid,
      email: u?.email ?? "",
      discord: (u?.discord ?? "").trim(),
      display_name: name || u?.email || "—",
      updated_at:
        typeof r.updated_at === "string"
          ? r.updated_at
          : r.updated_at
            ? String(r.updated_at)
            : null,
      created_at:
        typeof r.created_at === "string"
          ? r.created_at
          : r.created_at
            ? String(r.created_at)
            : null,
    };
  });

  data.sort((a, b) => {
    const ta = `${a.team_name} ${a.display_name}`;
    const tb = `${b.team_name} ${b.display_name}`;
    return ta.localeCompare(tb);
  });

  return { data, error: null };
}

async function upsertTeamMemberAssignment(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  team_id: string,
  user_id: string,
  appUserId: string
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  await admin.from("teams_members").delete().eq("user_id", user_id);
  const { error } = await admin.from("teams_members").insert({
    team_id,
    user_id,
    updated_by: appUserId,
    created_by: appUserId,
    created_at: now,
    updated_at: now,
  });
  if (error) return { error: error.message };
  return { error: null };
}

/** Search users not currently on any team roster for “Add member”. */
export async function searchUsersForTeamRoster(search: string): Promise<{
  data: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    discord: string;
  }[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { data: [], error: denied };

  const raw = search.trim().toLowerCase();
  if (raw.length < 2) return { data: [], error: null };

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const safe = `%${raw.replace(/[%]/g, "")}%`;

  const { data: occupying } = await admin.from("teams_members").select("user_id");
  const excluded = new Set((occupying ?? []).map((r) => String(r.user_id)));

  const userSel = "id, email, first_name, last_name, discord" as const;
  const [{ data: u1, error: e1 }, { data: u2, error: e2 }, { data: u3, error: e3 }, { data: u4, error: e4 }] =
    await Promise.all([
      admin.from("users").select(userSel).ilike("email", safe).limit(40),
      admin.from("users").select(userSel).ilike("first_name", safe).limit(40),
      admin.from("users").select(userSel).ilike("last_name", safe).limit(40),
      admin.from("users").select(userSel).ilike("discord", safe).limit(40),
    ]);
  const qErr = e1 ?? e2 ?? e3 ?? e4;
  if (qErr) return { data: [], error: qErr.message };

  const merged = new Map<
    string,
    {
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      discord: string | null;
    }
  >();
  for (const row of [...(u1 ?? []), ...(u2 ?? []), ...(u3 ?? []), ...(u4 ?? [])]) {
    if (row?.id) merged.set(String(row.id), row);
  }

  const filtered = [...merged.values()]
    .filter((u) => u?.id != null && !excluded.has(String(u.id)))
    .slice(0, 35);

  return {
    data: filtered.map((u) => ({
      id: String(u.id),
      email: u.email ?? "",
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
      discord: u.discord != null ? String(u.discord) : "",
    })),
    error: null,
  };
}

export async function addTeamMember(
  team_id: string,
  user_id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { error: denied };

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR };

  const err = await upsertTeamMemberAssignment(admin, team_id, user_id, appUserId);
  if (err.error) return err;

  revalidateTeamPages();
  return { error: null };
}

export async function removeTeamMember(
  team_id: string,
  user_id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { error: denied };

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR };

  const { error } = await admin
    .from("teams_members")
    .delete()
    .eq("team_id", team_id)
    .eq("user_id", user_id);

  if (error) return { error: error.message };
  revalidateTeamPages();
  return { error: null };
}

export type TeamRosterCsvRow = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  discord: string | null;
};

export async function importTeamMembersCsv(
  team_id: string,
  rows: TeamRosterCsvRow[]
): Promise<
  | { ok: true; added: number; not_found: number; failed_assignment: number }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const denied = assertManageTeams(profile);
  if (denied) return { ok: false, error: denied };

  const admin = getServiceRoleClient();
  if (!admin) return { ok: false, error: SERVICE_ROLE_ERROR };

  if (!team_id) return { ok: false, error: "Pick a team for this CSV import." };
  if (!rows.length || rows.length > 800) {
    return { ok: false, error: "CSV needs 1–800 roster rows." };
  }

  const { data: teamRow } = await admin.from("teams").select("id").eq("id", team_id).maybeSingle();
  if (!teamRow?.id) return { ok: false, error: "Team not found." };

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { ok: false, error: "Could not resolve your user account." };

  let added = 0;
  let failed_assignment = 0;
  let notFound = 0;

  for (const raw of rows) {
    const email = raw.email?.trim() || "";
    const fn = raw.first_name?.trim() ?? "";
    const ln = raw.last_name?.trim() ?? "";
    let uid: string | null = null;

    const discordLookup = raw.discord?.trim() ?? "";
    if (email) {
      const { data: u } = await admin
        .from("users")
        .select("id")
        .ilike("email", email.trim())
        .maybeSingle();
      if (u?.id) uid = String(u.id);
    }
    if (!uid && discordLookup) {
      const { data: udEq } = await admin
        .from("users")
        .select("id")
        .eq("discord", discordLookup)
        .maybeSingle();
      if (!udEq?.id) {
        const { data: udIlike } = await admin
          .from("users")
          .select("id")
          .ilike("discord", discordLookup)
          .maybeSingle();
        if (udIlike?.id) uid = String(udIlike.id);
      } else {
        uid = String(udEq.id);
      }
    }
    if (!uid && fn && ln) {
      const { data: list } = await admin
        .from("users")
        .select("id, first_name, last_name")
        .ilike("first_name", fn)
        .ilike("last_name", ln)
        .limit(4);
      if (list?.length === 1 && list[0]?.id != null) uid = String(list[0].id);
    }

    if (!uid) {
      notFound++;
      continue;
    }

    const next = await upsertTeamMemberAssignment(admin, team_id, uid, appUserId);
    if (next.error) {
      failed_assignment++;
      continue;
    }
    added++;
  }

  revalidateTeamPages();
  return { ok: true, added, not_found: notFound, failed_assignment };
}
