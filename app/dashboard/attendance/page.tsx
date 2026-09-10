import { fetchUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/types/rbac";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AttendanceContent } from "./AttendanceContent";
import { getActiveEvents } from "./actions";

export default async function AttendancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/attendance");
  }

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_attendance")) {
    redirect("/dashboard");
  }

  const [{ data: events, error }, headerList] = await Promise.all([
    getActiveEvents(),
    headers(),
  ]);

  // The QR is scanned by a phone on some other network, so the URL has to be
  // absolute and public - the request's own host is the one that is definitely
  // reachable, whether that is a preview deployment or production.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <p className="mt-1 text-muted-foreground">
          Show this code on a projector or laptop.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : (
        <AttendanceContent events={events} origin={origin} />
      )}
    </div>
  );
}
