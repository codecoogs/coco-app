import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { listPointCategories } from "./actions";
import { PointInformationContent } from "./PointInformationContent";

export default async function PointInformationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/point-information");
  }

  const profile = await fetchUserProfile(supabase, user.id);
  const canManage = hasPermission(profile, "manage_point_categories");

  const { data: categories, error } = await listPointCategories();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Point information
        </h1>
        <p className="mt-1 text-muted-foreground">
          Point values by category. Everyone signed in can view; only members
          with manage permission can add, edit, or delete categories.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : (
        <PointInformationContent
          initialCategories={categories}
          canManage={canManage}
        />
      )}
    </div>
  );
}
