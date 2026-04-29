"use server";

import { fetchUserProfile } from "@/lib/supabase/profile";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { hasPermission } from "@/lib/types/rbac";
import { revalidatePath } from "next/cache";

const PERMISSIONS_PATH = "/dashboard/permissions";
const SERVICE_ROLE_ERROR =
  "SUPABASE_SERVICE_ROLE_KEY is not set on the server. Permission management requires service role access.";

export type PermissionRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RolePermissionRow = {
  id: string;
  role_id: number;
  role_name: string;
  permission_id: string;
  permission_name: string;
  permission_description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RolePermissionsMatrixData = {
  roles: { id: number; name: string }[];
  permissions: { id: string; name: string; description: string | null }[];
  /**
   * role_id -> permission_id[] that are currently enabled for that role.
   */
  rolePermissionIds: Record<string, string[]>;
};

export type PositionPermissionMatrixRow = {
  position_id: number;
  position_title: string;
  role_id: number | null;
  role_name: string | null;
  direct_permissions: string[];
  inherited_permissions: string[];
  effective_permissions: string[];
};

export async function getPermissionsForManage(): Promise<{
  data: PermissionRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "view_officers")) {
    return { data: [], error: "You do not have permission to view permissions." };
  }

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const { data, error } = await admin
    .from("permissions")
    .select("id, name, description, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as PermissionRow[], error: null };
}

export async function createPermission(
  name: string,
  description: string | null
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_officers")) {
    return { error: "You do not have permission to manage permissions." };
  }

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return { error: "Permission name is required." };
  if (!/^[a-z][a-z0-9_]*$/.test(trimmed)) {
    return { error: "Use lowercase snake_case for permission names." };
  }

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR };

  const now = new Date().toISOString();
  const { error } = await admin.from("permissions").insert({
    name: trimmed,
    description: description?.trim() || null,
    created_by: appUserId,
    updated_by: appUserId,
    created_at: now,
    updated_at: now,
  });
  if (error) return { error: error.message };

  revalidatePath(PERMISSIONS_PATH);
  revalidatePath("/dashboard/officers");
  return { error: null };
}

export async function getRolePermissionsForManage(): Promise<{
  data: RolePermissionRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "view_officers")) {
    return { data: [], error: "You do not have permission to view role permissions." };
  }

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const { data, error } = await admin
    .from("role_permissions")
    .select("id, role_id, permission_id, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };

  const rows = (data ?? []) as {
    id: string;
    role_id: number | null;
    permission_id: string | null;
    created_at: string | null;
    updated_at: string | null;
  }[];
  const roleIds = [...new Set(rows.map((r) => r.role_id).filter((v): v is number => v != null))];
  const permIds = [
    ...new Set(rows.map((r) => r.permission_id).filter((v): v is string => typeof v === "string")),
  ];

  const [{ data: roles }, { data: perms }] = await Promise.all([
    roleIds.length ? admin.from("roles").select("id, name").in("id", roleIds) : Promise.resolve({ data: [] as { id: number; name: string }[] }),
    permIds.length
      ? admin.from("permissions").select("id, name, description").in("id", permIds)
      : Promise.resolve({ data: [] as { id: string; name: string; description: string | null }[] }),
  ]);
  const roleMap = new Map((roles ?? []).map((r) => [Number(r.id), String(r.name ?? "")]));
  const permMap = new Map(
    (perms ?? []).map((p) => [
      String(p.id),
      { name: String(p.name ?? ""), description: (p.description as string | null) ?? null },
    ])
  );

  const out: RolePermissionRow[] = rows
    .filter((r) => r.role_id != null && r.permission_id)
    .map((r) => {
      const p = permMap.get(String(r.permission_id));
      return {
        id: r.id,
        role_id: Number(r.role_id),
        role_name: roleMap.get(Number(r.role_id)) ?? "(unknown role)",
        permission_id: String(r.permission_id),
        permission_name: p?.name ?? "(unknown permission)",
        permission_description: p?.description ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    })
    .sort((a, b) => `${a.role_name}:${a.permission_name}`.localeCompare(`${b.role_name}:${b.permission_name}`));

  return { data: out, error: null };
}

export async function getPositionPermissionMatrixForManage(): Promise<{
  data: PositionPermissionMatrixRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "view_officers")) {
    return { data: [], error: "You do not have permission to view position permissions." };
  }

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: SERVICE_ROLE_ERROR };

  const [posRes, ppRes, rpRes, permRes, roleRes] = await Promise.all([
    admin.from("positions").select("id, title, role_id").order("title"),
    admin.from("position_permissions").select("position_id, permission_id"),
    admin.from("role_permissions").select("role_id, permission_id"),
    admin.from("permissions").select("id, name"),
    admin.from("roles").select("id, name"),
  ]);
  if (posRes.error) return { data: [], error: posRes.error.message };
  if (ppRes.error) return { data: [], error: ppRes.error.message };
  if (rpRes.error) return { data: [], error: rpRes.error.message };
  if (permRes.error) return { data: [], error: permRes.error.message };
  if (roleRes.error) return { data: [], error: roleRes.error.message };

  const permissionNameById = new Map(
    (permRes.data ?? []).map((p) => [String(p.id), String(p.name ?? "")])
  );
  const roleNameById = new Map((roleRes.data ?? []).map((r) => [Number(r.id), String(r.name ?? "")]));

  const directByPosition = new Map<number, Set<string>>();
  for (const row of ppRes.data ?? []) {
    const pid = Number(row.position_id);
    const pname = permissionNameById.get(String(row.permission_id));
    if (!Number.isFinite(pid) || !pname) continue;
    const set = directByPosition.get(pid) ?? new Set<string>();
    set.add(pname);
    directByPosition.set(pid, set);
  }

  const byRole = new Map<number, Set<string>>();
  for (const row of rpRes.data ?? []) {
    const rid = Number(row.role_id);
    const pname = permissionNameById.get(String(row.permission_id));
    if (!Number.isFinite(rid) || !pname) continue;
    const set = byRole.get(rid) ?? new Set<string>();
    set.add(pname);
    byRole.set(rid, set);
  }

  const out: PositionPermissionMatrixRow[] = (posRes.data ?? []).map((p) => {
    const pid = Number(p.id);
    const rid = p.role_id != null ? Number(p.role_id) : null;
    const direct = [...(directByPosition.get(pid) ?? new Set<string>())].sort();
    const inherited = rid != null ? [...(byRole.get(rid) ?? new Set<string>())].sort() : [];
    const effective = [...new Set([...inherited, ...direct])].sort();
    return {
      position_id: pid,
      position_title: String(p.title ?? ""),
      role_id: rid,
      role_name: rid != null ? roleNameById.get(rid) ?? null : null,
      direct_permissions: direct,
      inherited_permissions: inherited,
      effective_permissions: effective,
    };
  });

  return { data: out, error: null };
}

export async function getRolePermissionsMatrixForManage(): Promise<{
  data: RolePermissionsMatrixData;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: { roles: [], permissions: [], rolePermissionIds: {} }, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "view_officers")) {
    return { data: { roles: [], permissions: [], rolePermissionIds: {} }, error: "You do not have permission to view role permissions." };
  }

  const admin = getServiceRoleClient();
  if (!admin) return { data: { roles: [], permissions: [], rolePermissionIds: {} }, error: SERVICE_ROLE_ERROR };

  const [rolesRes, permsRes, rpRes] = await Promise.all([
    admin.from("roles").select("id, name").order("name"),
    admin.from("permissions").select("id, name, description").order("name"),
    admin.from("role_permissions").select("role_id, permission_id"),
  ]);

  if (rolesRes.error) return { data: { roles: [], permissions: [], rolePermissionIds: {} }, error: rolesRes.error.message };
  if (permsRes.error) return { data: { roles: [], permissions: [], rolePermissionIds: {} }, error: permsRes.error.message };
  if (rpRes.error) return { data: { roles: [], permissions: [], rolePermissionIds: {} }, error: rpRes.error.message };

  const roles = (rolesRes.data ?? []).map((r) => ({
    id: Number((r as { id: number }).id),
    name: String((r as { name: string | null }).name ?? ""),
  }));

  const permissions = (permsRes.data ?? []).map((p) => ({
    id: String((p as { id: string }).id),
    name: String((p as { name: string | null }).name ?? ""),
    description:
      typeof (p as { description: string | null }).description === "string"
        ? (p as { description: string | null }).description
        : null,
  }));

  const rolePermissionIds: Record<string, Set<string>> = {};
  for (const row of rpRes.data ?? []) {
    const rid = row.role_id != null ? String(row.role_id) : null;
    const pid = row.permission_id != null ? String(row.permission_id) : null;
    if (!rid || !pid) continue;
    const set = rolePermissionIds[rid] ?? new Set<string>();
    set.add(pid);
    rolePermissionIds[rid] = set;
  }

  const rolePermissionIdsOut: Record<string, string[]> = {};
  for (const [rid, set] of Object.entries(rolePermissionIds)) {
    rolePermissionIdsOut[rid] = [...set].sort();
  }

  return { data: { roles, permissions, rolePermissionIds: rolePermissionIdsOut }, error: null };
}

export async function setRolePermissionForManage(
  roleId: number,
  permissionId: string,
  enabled: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_officers")) {
    return { error: "You do not have permission to manage roles permissions." };
  }

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR };

  if (enabled) {
    const now = new Date().toISOString();
    const { error } = await admin.from("role_permissions").upsert(
      {
        role_id: roleId,
        permission_id: permissionId,
        created_by: appUserId,
        updated_by: appUserId,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "role_id, permission_id" }
    );
    if (error) return { error: error.message };
  } else {
    const { error } = await admin
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permissionId);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/permissions");
  return { error: null };
}

export async function setPositionPermissionForManage(
  positionId: number,
  permissionId: string,
  enabled: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_officers")) {
    return { error: "You do not have permission to manage position permissions." };
  }

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const admin = getServiceRoleClient();
  if (!admin) return { error: SERVICE_ROLE_ERROR };

  if (enabled) {
    const now = new Date().toISOString();
    const { error } = await admin.from("position_permissions").upsert(
      {
        position_id: positionId,
        permission_id: permissionId,
        created_by: appUserId,
        updated_by: appUserId,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "position_id, permission_id" }
    );
    if (error) return { error: error.message };
  } else {
    const { error } = await admin
      .from("position_permissions")
      .delete()
      .eq("position_id", positionId)
      .eq("permission_id", permissionId);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/permissions");
  return { error: null };
}
