import { fetchUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { getOrgChart } from "./actions";
import { OrgChartCanvas } from "./OrgChartCanvas";

export default async function OrgChartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/org-chart");
  }

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasAnyPermission(profile, ["view_positions", "manage_positions"])) {
    redirect("/dashboard");
  }

  const canEdit = hasPermission(profile, "manage_positions");
  const { data, error } = await getOrgChart();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Org chart</h1>
        <p className="mt-1 text-muted-foreground">
          {canEdit
            ? "Drag a position to move it, and drag from the bottom of one onto another to set who reports to whom. Changes are saved when you press Save."
            : "Who reports to whom across the organization."}
        </p>
      </div>

      <OrgChartCanvas initialNodes={data} canEdit={canEdit} loadError={error} />
    </div>
  );
}
