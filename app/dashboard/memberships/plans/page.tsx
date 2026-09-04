import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { getMembershipPlansForManage, getPeriodOptions } from "./actions";
import { MembershipsAdminContent } from "./MembershipsAdminContent";

export default async function MembershipPlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/memberships/plans");
  }

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_memberships")) {
    redirect("/dashboard");
  }

  const [{ data, error }, periodOptions] = await Promise.all([
    getMembershipPlansForManage(),
    getPeriodOptions(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Membership plans</h1>
        <p className="mt-1 text-muted-foreground">
          Manage the plans members can purchase, and the academic years and semesters they&apos;re
          sold against.
        </p>
      </div>

      {error || periodOptions.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error || periodOptions.error}
        </div>
      ) : (
        <MembershipsAdminContent
          initialPlans={data}
          initialSemesters={periodOptions.semesters}
          initialAcademicYears={periodOptions.academicYears}
        />
      )}
    </div>
  );
}
