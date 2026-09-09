"use server";

import { createCheckInToken, msUntilNextWindow } from "@/lib/attendance-token";
import { getEventState } from "@/lib/event-status";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/types/rbac";

export type ActiveEvent = {
  id: number;
  title: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
};

async function requireManageAttendance(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return false;
  const profile = await fetchUserProfile(supabase, user.id);
  return hasPermission(profile, "manage_attendance");
}

/**
 * Events happening right now. Filtered in SQL to a rough window, then narrowed
 * with getEventState so "active" means exactly what it means everywhere else
 * in the app (cancelled events included in that - they are not active).
 */
export async function getActiveEvents(): Promise<{
  data: ActiveEvent[];
  error: string | null;
}> {
  if (!(await requireManageAttendance())) {
    return { data: [], error: "You do not have permission to manage attendance." };
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, location, start_time, end_time, status")
    .lte("start_time", nowIso)
    .gte("end_time", nowIso)
    .order("start_time", { ascending: true });

  if (error) return { data: [], error: error.message };

  const active = (data ?? [])
    .filter((event) => getEventState(event) === "active")
    .map(({ id, title, location, start_time, end_time }) => ({
      id,
      title,
      location,
      start_time,
      end_time,
    }));

  return { data: active, error: null };
}

/**
 * Mints the next check-in token. Called on a timer by the QR screen, so it also
 * returns how long the token has left - the client uses that instead of its own
 * clock, which may be off from the server's.
 */
export async function mintCheckInToken(
  eventId: number
): Promise<{ token: string; expiresInMs: number; error: string | null }> {
  if (!(await requireManageAttendance())) {
    return { token: "", expiresInMs: 0, error: "Not allowed." };
  }
  const now = Date.now();
  return {
    token: createCheckInToken(eventId, now),
    expiresInMs: msUntilNextWindow(now),
    error: null,
  };
}
