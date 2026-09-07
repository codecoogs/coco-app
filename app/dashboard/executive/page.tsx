import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { ExecutiveDashboard } from "./ExecutiveDashboard";

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

  return <ExecutiveDashboard />;
}
