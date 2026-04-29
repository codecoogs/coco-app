"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { revalidatePath } from "next/cache";

const MY_TEAM_PATH = "/dashboard/my-team";
const TEAMS_PATH = "/dashboard/teams";
const TEAM_IMAGES_BUCKET = "assets";
const TEAM_IMAGES_PREFIX = "team-images";
const MAX_TEAM_IMAGE_BYTES = 6 * 1024 * 1024;

type TeamBasics = {
  id: string;
  name: string;
  team_number: number;
  description: string | null;
  team_image_url: string | null;
};

export type MyTeamView = {
  team: TeamBasics | null;
  members: { id: string; name: string; email: string }[];
  canManage: boolean;
  loadError: string | null;
};

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

async function getCurrentAppUserIdByAuth() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { supabase, authUser: null, appUserId: null };
  const { data: u } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .maybeSingle();
  return { supabase, authUser, appUserId: u?.id ? String(u.id) : null };
}

export async function getMyTeamView(): Promise<MyTeamView> {
  const { supabase, authUser, appUserId } = await getCurrentAppUserIdByAuth();
  if (!authUser?.id || !appUserId) {
    return { team: null, members: [], canManage: false, loadError: "Not signed in." };
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  const canManageAllTeams = hasPermission(profile, "manage_teams");

  const { data: teamLeadRow, error: leadErr } = await supabase
    .from("teams_leads")
    .select("team_id")
    .eq("user_id", appUserId)
    .maybeSingle();
  if (leadErr) {
    return { team: null, members: [], canManage: false, loadError: leadErr.message };
  }

  const { data: memberRow, error: memberErr } = await supabase
    .from("teams_members")
    .select("team_id")
    .eq("user_id", appUserId)
    .maybeSingle();
  if (memberErr) {
    return { team: null, members: [], canManage: false, loadError: memberErr.message };
  }

  const teamId = teamLeadRow?.team_id ?? memberRow?.team_id ?? null;
  if (!teamId) {
    return { team: null, members: [], canManage: canManageAllTeams, loadError: null };
  }

  const canManage = canManageAllTeams || teamLeadRow?.team_id === teamId;

  const [{ data: teamRow, error: teamErr }, { data: tmRows, error: tmErr }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, team_number, description, team_image_url")
      .eq("id", teamId)
      .maybeSingle(),
    supabase.from("teams_members").select("user_id").eq("team_id", teamId),
  ]);
  if (teamErr) {
    return { team: null, members: [], canManage, loadError: teamErr.message };
  }
  if (tmErr) {
    return { team: null, members: [], canManage, loadError: tmErr.message };
  }

  const userIds = (tmRows ?? []).map((r) => String(r.user_id));
  const { data: usersRows, error: usersErr } = userIds.length
    ? await supabase
        .from("users")
        .select("id, first_name, last_name, email")
        .in("id", userIds)
    : { data: [], error: null };
  if (usersErr) {
    return { team: null, members: [], canManage, loadError: usersErr.message };
  }

  const members = (usersRows ?? [])
    .map((u) => {
      const first = typeof u.first_name === "string" ? u.first_name.trim() : "";
      const last = typeof u.last_name === "string" ? u.last_name.trim() : "";
      const email = typeof u.email === "string" ? u.email : "";
      return {
        id: String(u.id),
        name: [first, last].filter(Boolean).join(" ") || email || "Member",
        email,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    team: teamRow
      ? {
          id: String(teamRow.id),
          name: String(teamRow.name ?? "Team"),
          team_number:
            typeof teamRow.team_number === "number"
              ? teamRow.team_number
              : Number(teamRow.team_number) || 0,
          description:
            typeof teamRow.description === "string" ? teamRow.description : null,
          team_image_url:
            typeof teamRow.team_image_url === "string" ? teamRow.team_image_url : null,
        }
      : null,
    members,
    canManage,
    loadError: null,
  };
}

export async function updateMyTeam(formData: FormData): Promise<{ error: string | null }> {
  const { supabase, authUser, appUserId } = await getCurrentAppUserIdByAuth();
  if (!authUser?.id || !appUserId) return { error: "Not signed in." };

  const teamId = String(formData.get("team_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const uploaded = formData.get("team_image_file");
  const removeImage = String(formData.get("remove_team_image") ?? "") === "true";
  if (!teamId) return { error: "Missing team id." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  const canManageAllTeams = hasPermission(profile, "manage_teams");

  const { data: leadRow, error: leadErr } = await supabase
    .from("teams_leads")
    .select("team_id")
    .eq("user_id", appUserId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (leadErr) return { error: leadErr.message };

  if (!canManageAllTeams && !leadRow?.team_id) {
    return { error: "Only team leads (or manage teams) can edit this team." };
  }

  if (!name) return { error: "Team name is required." };

  const { data: currentTeam, error: curErr } = await supabase
    .from("teams")
    .select("team_image_url")
    .eq("id", teamId)
    .maybeSingle();
  if (curErr) return { error: curErr.message };

  let teamImageUrl: string | null =
    typeof currentTeam?.team_image_url === "string" ? currentTeam.team_image_url : null;

  if (uploaded instanceof File && uploaded.size > 0) {
    if (!isAllowedTeamImageMime(uploaded.type)) {
      return { error: "Use a JPEG, PNG, or WebP image." };
    }
    if (uploaded.size > MAX_TEAM_IMAGE_BYTES) {
      return { error: "Team image is too large (max 6MB)." };
    }
    const ext = extFromMime(uploaded.type);
    const body = new Uint8Array(await uploaded.arrayBuffer());
    const objectPath = `${TEAM_IMAGES_PREFIX}/${teamId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(TEAM_IMAGES_BUCKET)
      .upload(objectPath, body, {
        contentType: uploaded.type,
        upsert: false,
      });
    if (upErr) return { error: upErr.message };

    const { data: pub } = supabase.storage
      .from(TEAM_IMAGES_BUCKET)
      .getPublicUrl(objectPath);
    teamImageUrl = pub.publicUrl;

    if (currentTeam?.team_image_url) {
      const oldPath = storagePathFromAssetsPublicUrl(currentTeam.team_image_url);
      if (oldPath && oldPath !== objectPath) {
        await supabase.storage.from(TEAM_IMAGES_BUCKET).remove([oldPath]);
      }
    }
  } else if (removeImage && currentTeam?.team_image_url) {
    const oldPath = storagePathFromAssetsPublicUrl(currentTeam.team_image_url);
    if (oldPath) {
      await supabase.storage.from(TEAM_IMAGES_BUCKET).remove([oldPath]);
    }
    teamImageUrl = null;
  }

  const { error } = await supabase
    .from("teams")
    .update({
      name,
      description,
      team_image_url: teamImageUrl,
      updated_at: new Date().toISOString(),
      updated_by: appUserId,
    })
    .eq("id", teamId);
  if (error) return { error: error.message };

  revalidatePath(MY_TEAM_PATH);
  revalidatePath(TEAMS_PATH);
  revalidatePath("/dashboard/team-management");
  return { error: null };
}
