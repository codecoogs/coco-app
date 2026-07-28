import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { getForms } from "../actions";
import { FormsManagementContent } from "./FormsManagementContent";

export default async function FormsManagementPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect("/login?next=/dashboard/forms/manage");
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_forms")) {
    redirect("/dashboard");
  }

  const { data, error } = await getForms();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Forms management</h1>
        <p className="mt-1 text-muted-foreground">
          Create and edit forms, control who they&apos;re visible to, and
          review responses.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : (
        <FormsManagementContent initialForms={data} />
      )}
    </div>
  );
}
