import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { getEvents, getPointCategories } from "../actions";
import { EventsManagementContent } from "../EventsManagementContent";
import { getResourcesForManage } from "../resources/actions";

export default async function EventsManagementPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect("/login?next=/dashboard/events/manage");
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_events")) {
    redirect("/dashboard");
  }

  const canManageResources = hasPermission(profile, "manage_resources");

  const [eventsRes, catRes, resourcesRes] = await Promise.all([
    getEvents(),
    getPointCategories(),
    canManageResources
      ? getResourcesForManage()
      : Promise.resolve({ data: [], error: null }),
  ]);

  const canManage = hasPermission(profile, "manage_events");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Events management
        </h1>
        <p className="mt-1 text-muted-foreground">
          Create and edit events, upload flyers, and manage attendance
          {canManageResources
            ? ", and curate the resources shown on the website"
            : ""}
          .
        </p>
      </div>

      {eventsRes.error || catRes.error || resourcesRes.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {eventsRes.error ?? catRes.error ?? resourcesRes.error}
        </div>
      ) : (
        <EventsManagementContent
          initialEvents={eventsRes.data}
          categories={catRes.data}
          canManage={canManage}
          initialResources={resourcesRes.data}
          canManageResources={canManageResources}
        />
      )}
    </div>
  );
}

