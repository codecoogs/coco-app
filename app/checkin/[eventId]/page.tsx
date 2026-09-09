import { getEventState } from "@/lib/event-status";
import { verifyCheckInToken } from "@/lib/attendance-token";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ t?: string }>;
};

/**
 * Landing page for a scanned event QR code.
 *
 * Nothing renders here: every path ends in a redirect to the dashboard, which
 * shows the outcome as a modal (see CheckInResultModal). A scanner who is not
 * signed in is sent to sign in or sign up first and lands back here afterwards
 * - the token survives the round trip in `next`, and the 15s window is checked
 * only once they return, so a slow sign-up is not punished with a dead token.
 */
export default async function CheckInPage({ params, searchParams }: Props) {
  const [{ eventId: rawEventId }, { t }] = await Promise.all([params, searchParams]);

  const eventId = Number(rawEventId);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    redirect("/dashboard?checkin=invalid");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    const back = `/checkin/${eventId}${t ? `?t=${encodeURIComponent(t)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  if (!verifyCheckInToken(eventId, t)) {
    redirect(`/dashboard?checkin=expired&event=${eventId}`);
  }

  const admin = getServiceRoleClient();
  if (!admin) {
    redirect(`/dashboard?checkin=error&event=${eventId}`);
  }

  const { data: event } = await admin
    .from("events")
    .select("id, title, status, start_time, end_time")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    redirect("/dashboard?checkin=invalid");
  }

  // A valid token for an event that is over should still not check anyone in -
  // the token is the anti-sharing measure, this is the anti-time-travel one.
  if (getEventState(event) !== "active") {
    redirect(`/dashboard?checkin=closed&event=${eventId}`);
  }

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) {
    redirect(`/dashboard?checkin=error&event=${eventId}`);
  }

  const { data: existing } = await admin
    .from("events_attendance")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", appUserId)
    .maybeSingle();

  if (existing) {
    redirect(`/dashboard?checkin=already&event=${eventId}`);
  }

  // The point transaction, its pending/applied status and the leaderboard all
  // follow from this insert via database triggers.
  const { error } = await admin
    .from("events_attendance")
    .insert({ event_id: eventId, user_id: appUserId });

  if (error) {
    redirect(`/dashboard?checkin=error&event=${eventId}`);
  }

  redirect(`/dashboard?checkin=ok&event=${eventId}`);
}
