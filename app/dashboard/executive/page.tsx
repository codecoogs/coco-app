import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { getExecutiveDashboardData } from "./actions";
import { ExecutiveDashboardContent } from "./ExecutiveDashboardContent";

export default async function ExecutiveDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/executive");
  }

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "view_executive_dashboard")) {
    redirect("/dashboard");
  }

  const data = await getExecutiveDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Executive dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Member growth, sign-ups, memberships, and form activity.
        </p>
      </div>

      <ExecutiveDashboardContent data={data} />
    </div>
  );
}
