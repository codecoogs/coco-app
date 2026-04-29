import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasAnyPermission, hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { listPointCategories } from "../point-information/actions";
import { getUsersWithPointsForManagement } from "./actions";
import { PointManagementContent } from "./PointManagementContent";

export default async function PointManagementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/point-management");
  }

  const profile = await fetchUserProfile(supabase, user.id);

  const canManageCategories = hasPermission(profile, "manage_point_categories");
  const canManagePoints = hasPermission(profile, "manage_points");
  const canViewPointsTransactions = hasAnyPermission(profile, ["view_points", "manage_points"]);

  if (!canManageCategories && !canManagePoints) {
    redirect("/dashboard");
  }

  const [categoriesRes, usersRes] = await Promise.all([
    listPointCategories(),
    canViewPointsTransactions ? getUsersWithPointsForManagement() : Promise.resolve({ data: [], error: null }),
  ]);

  if (categoriesRes.error) {
    // Let the content render with an empty list; the actions tab will still function.
  }

  return (
    <div className="space-y-6">
      <PointManagementContent
        initialCategories={categoriesRes.data}
        canManageCategories={canManageCategories}
        canManagePoints={canManagePoints}
        canViewPointsTransactions={canViewPointsTransactions}
        usersWithPoints={usersRes.data}
      />
    </div>
  );
}

