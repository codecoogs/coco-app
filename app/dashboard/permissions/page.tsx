import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import {
  getPermissionsForManage,
  getPositionPermissionMatrixForManage,
  getRolePermissionsMatrixForManage,
} from "./actions";
import { PermissionsContent } from "./PermissionsContent";

export default async function PermissionsPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect("/login?next=/dashboard/permissions");
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_officers")) {
    redirect("/dashboard");
  }

  const canManage = hasPermission(profile, "manage_officers");
  const [permissionsRes, rolePermMatrixRes, positionPermRes] = await Promise.all([
    getPermissionsForManage(),
    getRolePermissionsMatrixForManage(),
    getPositionPermissionMatrixForManage(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Permissions</h1>
        <p className="mt-1 text-muted-foreground">
          View available permissions and add new permission keys.
        </p>
      </div>

      <PermissionsContent
        initialRows={permissionsRes.data}
        initialRolePermissionsMatrix={rolePermMatrixRes.data}
        initialPositionPermissionMatrix={positionPermRes.data}
        canManage={canManage}
        loadError={
          permissionsRes.error ?? rolePermMatrixRes.error ?? positionPermRes.error
        }
      />
    </div>
  );
}
