import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  EventsPageContent,
  type EventsPublicRow,
} from "./EventsPageContent";

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect("/login?next=/dashboard/events");
  }

  const nowIso = new Date().toISOString();

  // Main events view: upcoming public listings only (officers manage the full roster elsewhere).
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, description, location, start_time, end_time, flyer_url, is_public, status",
    )
    .eq("is_public", true)
    .not("start_time", "is", null)
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true, nullsFirst: false });

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
        {error.message}
      </div>
    );
  }

  return (
    <EventsPageContent initialEvents={(data ?? []) as EventsPublicRow[]} />
  );
}
