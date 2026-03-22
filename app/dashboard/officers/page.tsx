import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { getOfficers } from "./actions";
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

  const { data: officers, error } = await getOfficers();

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
          canManage={hasPermission(profile, "manage_officers")}
        />
      )}
    </div>
  );
}
