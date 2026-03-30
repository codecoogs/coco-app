import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import {
  getBranchOptions,
  getBranchesForManage,
  getOfficers,
  getPositionsForManage,
  getRoleOptions,
} from "./actions";
import { OfficersContent } from "./OfficersContent";

export default async function OfficersPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect("/login?next=/dashboard/officers");
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "view_officers")) {
    redirect("/dashboard");
  }

  const canManage = hasPermission(profile, "manage_officers");
  const { data: officers, error } = await getOfficers();

  let positionsForManage: Awaited<ReturnType<typeof getPositionsForManage>>["data"] = [];
  let branchesForManage: Awaited<ReturnType<typeof getBranchesForManage>>["data"] = [];
  let branchOptions: Awaited<ReturnType<typeof getBranchOptions>>["data"] = [];
  let roleOptions: Awaited<ReturnType<typeof getRoleOptions>>["data"] = [];
  let positionsLoadError: string | null = null;
  let branchesLoadError: string | null = null;

  if (canManage) {
    const [pr, br, rr, bmr] = await Promise.all([
      getPositionsForManage(),
      getBranchOptions(),
      getRoleOptions(),
      getBranchesForManage(),
    ]);
    positionsForManage = pr.data;
    branchOptions = br.data;
    roleOptions = rr.data;
    branchesForManage = bmr.data;
    positionsLoadError = pr.error ?? br.error ?? rr.error;
    branchesLoadError = bmr.error;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Officers</h1>
        <p className="mt-1 text-muted-foreground">
          View and manage officer position assignments. Only users with manage
          permission can add, edit, or deactivate.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : (
        <OfficersContent
          officers={officers}
          canManage={canManage}
          positionsForManage={positionsForManage}
          branchesForManage={branchesForManage}
          branchOptions={branchOptions}
          roleOptions={roleOptions}
          positionsLoadError={positionsLoadError}
          branchesLoadError={branchesLoadError}
        />
      )}
    </div>
  );
}
