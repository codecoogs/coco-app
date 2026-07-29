import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { getOpportunitiesForManage } from "../actions";
import { OpportunitiesManagementContent } from "./OpportunitiesManagementContent";

export default async function OpportunitiesManagementPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect("/login?next=/dashboard/opportunities/manage");
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_opportunities")) {
    redirect("/dashboard");
  }

  const { data, error } = await getOpportunitiesForManage();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Opportunities management
        </h1>
        <p className="mt-1 text-muted-foreground">
          Add jobs and roles manually, or import a CSV export. Imported
          postings land inactive until you review and activate them.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : (
        <OpportunitiesManagementContent initialOpportunities={data} />
      )}
    </div>
  );
}
