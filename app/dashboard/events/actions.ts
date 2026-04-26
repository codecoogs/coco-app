"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { hasAnyPermission, hasPermission } from "@/lib/types/rbac";
import { revalidatePath } from "next/cache";

/** Server client from createClient(); carries the user session so requests include the user JWT. */
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type EventRow = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  /** `point_categories.name` (FK) — not the category row id. */
  point_category: string | null;
  /** Redundant with `point_category` when the FK is by name; kept for the UI. */
  point_category_name: string | null;
  point_category_points: number | null;
  flyer_url: string | null;
  is_public: boolean;
  status: string;
  google_event_id: string | null;
};

export type PointCategoryOption = {
  id: string;
  name: string;
  points_value: number;
};

/** One check-in row for the events attendance UI (flattened from Supabase embed). */
export type EventAttendanceBulkRow = {
  id: string;
  event_id: number;
  user_id: string;
  attended_at: string | null;
  first_name: string | null;
  last_name: string | null;
  /** From `users.email` for search / display. */
  email: string | null;
};

/** Attendee present in CSV import but not matched to `public.users` at import time. */
export type UnassignedAttendanceRow = {
  id: string;
  event_id: number;
  first_name: string;
  last_name: string;
  discord: string | null;
  personal_email: string | null;
  cougarnet_email: string | null;
  is_user: boolean;
  attended_at: string | null;
};

export type EventFormInput = {
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  point_category: string;
  flyer_url: string | null;
  is_public: boolean;
};

async function requireViewOrManageEvents(): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Not signed in." };
  }
  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasAnyPermission(profile, ["view_events", "manage_events"])) {
    return {
      ok: false,
      error: "You do not have permission to view events.",
    };
  }
  return { ok: true };
}

async function requireManageEvents(): Promise<
  | { ok: true; supabase: ServerSupabaseClient }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Not signed in." };
  }
  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_events")) {
    return {
      ok: false,
      error: "You do not have permission to manage events.",
    };
  }
  return { ok: true, supabase };
}

/**
 * Invokes the Edge Function with the standard Supabase server client only.
 * The client attaches the logged-in user's JWT (required when verify_jwt is true).
 * Do not use createAdminClient() / service role here.
 */
async function syncGoogleCalendar(
  supabase: ServerSupabaseClient,
  payload: {
    title: string;
    description: string | null;
    startTime: string;
    endTime: string;
    flyerUrl: string | null;
    googleEventId: string | null;
  }
): Promise<{ google_event_id: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(
    "google-calendar-sync",
    { body: payload }
  );

  if (error) {
    return { google_event_id: null, error: error.message };
  }

  const body = data as
    | { google_event_id?: string; error?: string; detail?: unknown }
    | null;

  if (body?.error) {
    return { google_event_id: null, error: String(body.error) };
  }
  if (!body?.google_event_id) {
    return {
      google_event_id: null,
      error: "Calendar sync did not return google_event_id.",
    };
  }
  return { google_event_id: body.google_event_id, error: null };
}

export async function getEvents(): Promise<{
  data: EventRow[];
  error: string | null;
}> {
  const gate = await requireViewOrManageEvents();
  if (!gate.ok) return { data: [], error: gate.error };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("events")
    .select(
      "id, title, description, location, start_time, end_time, point_category, flyer_url, is_public, status, google_event_id"
    )
    .order("start_time", { ascending: true, nullsFirst: false });

  if (error) return { data: [], error: error.message };

  const raw = (rows ?? []) as Omit<
    EventRow,
    "point_category_name" | "point_category_points"
  >[];

  const { data: allCats, error: catErr } = await supabase
    .from("point_categories")
    .select("id, name, points_value")
    .order("name");

  if (catErr) return { data: [], error: catErr.message };

  const byName = new Map<string, PointCategoryOption>();
  const byId = new Map<string, PointCategoryOption>();
  for (const c of (allCats ?? []) as PointCategoryOption[]) {
    byName.set(c.name, c);
    byId.set(c.id, c);
  }

  const data: EventRow[] = raw.map((r) => {
    const key = r.point_category?.trim() || null;
    const cat = key
      ? (byName.get(key) ?? byId.get(key))
      : undefined;
    return {
      ...r,
      point_category_name: cat?.name ?? null,
      point_category_points: cat?.points_value ?? null,
    };
  });

  return { data, error: null };
}

export async function getEventsAttendanceBulk(): Promise<{
  data: EventAttendanceBulkRow[];
  error: string | null;
}> {
  const gate = await requireViewOrManageEvents();
  if (!gate.ok) return { data: [], error: gate.error };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("events_attendance")
    .select(
      "id, event_id, user_id, attended_at, users!events_attended_user_id_fkey (first_name, last_name, email)"
    )
    .order("attended_at", { ascending: false, nullsFirst: false });

  if (error) return { data: [], error: error.message };

  type Raw = {
    id: string;
    event_id: number;
    user_id: string;
    attended_at: string | null;
    users:
      | { first_name: string | null; last_name: string | null; email: string | null }
      | {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        }[]
      | null;
  };

  const data: EventAttendanceBulkRow[] = ((rows ?? []) as unknown as Raw[]).map(
    (r) => {
      const u = Array.isArray(r.users) ? r.users[0] : r.users;
      return {
        id: r.id,
        event_id: r.event_id,
        user_id: r.user_id,
        attended_at: r.attended_at,
        first_name: u?.first_name ?? null,
        last_name: u?.last_name ?? null,
        email: u?.email ?? null,
      };
    }
  );

  return { data, error: null };
}

export async function getUnassignedAttendanceBulk(): Promise<{
  data: UnassignedAttendanceRow[];
  error: string | null;
}> {
  const gate = await requireViewOrManageEvents();
  if (!gate.ok) return { data: [], error: gate.error };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("unassigned_attendance")
    .select(
      "id, event_id, first_name, last_name, discord, personal_email, cougarnet_email, is_user, attended_at"
    )
    .order("attended_at", { ascending: false, nullsFirst: false });

  if (error) return { data: [], error: error.message };

  return {
    data: (rows ?? []) as UnassignedAttendanceRow[],
    error: null,
  };
}

export async function getPointCategories(): Promise<{
  data: PointCategoryOption[];
  error: string | null;
}> {
  const gate = await requireViewOrManageEvents();
  if (!gate.ok) return { data: [], error: gate.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("point_categories")
    .select("id, name, points_value")
    .order("name");

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []) as PointCategoryOption[],
    error: null,
  };
}

export async function createEvent(
  input: EventFormInput
): Promise<{ error: string | null }> {
  const gate = await requireManageEvents();
  if (!gate.ok) return { error: gate.error };

  const syncRes = await syncGoogleCalendar(gate.supabase, {
    title: input.title,
    description: input.description,
    startTime: input.start_time,
    endTime: input.end_time,
    flyerUrl: input.flyer_url,
    googleEventId: null,
  });
  if (syncRes.error) return { error: syncRes.error };

  const { error } = await gate.supabase.from("events").insert({
    title: input.title,
    description: input.description,
    location: input.location,
    start_time: input.start_time,
    end_time: input.end_time,
    point_category: input.point_category,
    flyer_url: input.flyer_url,
    is_public: input.is_public,
    status: "active",
    google_event_id: syncRes.google_event_id,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/events/manage");
  return { error: null };
}

export async function updateEvent(
  id: number,
  input: EventFormInput
): Promise<{ error: string | null }> {
  const gate = await requireManageEvents();
  if (!gate.ok) return { error: gate.error };

  const { data: existing, error: fetchErr } = await gate.supabase
    .from("events")
    .select("google_event_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!existing) return { error: "Event not found." };

  const syncRes = await syncGoogleCalendar(gate.supabase, {
    title: input.title,
    description: input.description,
    startTime: input.start_time,
    endTime: input.end_time,
    flyerUrl: input.flyer_url,
    googleEventId: existing.google_event_id ?? null,
  });
  if (syncRes.error) return { error: syncRes.error };

  const { error } = await gate.supabase
    .from("events")
    .update({
      title: input.title,
      description: input.description,
      location: input.location,
      start_time: input.start_time,
      end_time: input.end_time,
      point_category: input.point_category,
      flyer_url: input.flyer_url,
      is_public: input.is_public,
      google_event_id: syncRes.google_event_id,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/events/manage");
  return { error: null };
}

export async function toggleEventPublic(
  id: number
): Promise<{ error: string | null }> {
  const gate = await requireManageEvents();
  if (!gate.ok) return { error: gate.error };

  const { data: row, error: fetchErr } = await gate.supabase
    .from("events")
    .select("is_public")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Event not found." };

  const next = !row.is_public;
  const { error } = await gate.supabase
    .from("events")
    .update({ is_public: next })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/events/manage");
  return { error: null };
}

export async function cancelEvent(id: number): Promise<{ error: string | null }> {
  const gate = await requireManageEvents();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/events/manage");
  return { error: null };
}

const ATTENDANCE_SERVICE_ROLE_ERROR =
  "Server configuration is missing the service role key, which is required to look up members for attendance.";

function escapeIlike(value: string): string {
  return `%${value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

/** Member row for the attendance add flow (search by name, email, or Discord). */
export type UserSearchResult = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  discord: string | null;
};

/**
 * Fuzzy search on `public.users` for event managers. Uses the service role so search is not
 * limited to leaderboard-visible profiles (see RLS on `public.users`).
 */
export async function searchUsersForAttendance(
  query: string
): Promise<{ data: UserSearchResult[]; error: string | null }> {
  const gate = await requireManageEvents();
  if (!gate.ok) return { data: [], error: gate.error };

  const q = query.trim();
  if (q.length < 1) {
    return { data: [], error: null };
  }
  if (q.length > 200) {
    return { data: [], error: "Search is too long." };
  }

  const admin = getServiceRoleClient();
  if (!admin) {
    return { data: [], error: ATTENDANCE_SERVICE_ROLE_ERROR };
  }

  const pattern = escapeIlike(q);
  const sel = "id, first_name, last_name, email, discord";
  const limit = 20;

  const [em, fn, ln, dc] = await Promise.all([
    admin.from("users").select(sel).ilike("email", pattern).limit(limit),
    admin.from("users").select(sel).ilike("first_name", pattern).limit(limit),
    admin.from("users").select(sel).ilike("last_name", pattern).limit(limit),
    admin.from("users").select(sel).ilike("discord", pattern).limit(limit),
  ]);

  const err =
    em.error?.message ||
    fn.error?.message ||
    ln.error?.message ||
    dc.error?.message;
  if (err) return { data: [], error: err };

  const merged = new Map<string, UserSearchResult>();
  for (const row of [em.data, fn.data, ln.data, dc.data]) {
    for (const r of (row ?? []) as UserSearchResult[]) {
      if (r?.id) merged.set(r.id, r);
    }
  }
  return { data: [...merged.values()].slice(0, 25), error: null };
}

export async function recordEventAttendance(
  eventId: number,
  userId: string
): Promise<{ error: string | null }> {
  const gate = await requireManageEvents();
  if (!gate.ok) return { error: gate.error };

  const admin = getServiceRoleClient();
  if (!admin) {
    return { error: ATTENDANCE_SERVICE_ROLE_ERROR };
  }

  const { data: existing, error: exErr } = await admin
    .from("events_attendance")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (exErr) return { error: exErr.message };
  if (existing) {
    return { error: "This member is already recorded for this event." };
  }

  const { error } = await admin.from("events_attendance").insert({
    event_id: eventId,
    user_id: userId,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/events/manage");
  return { error: null };
}

export type AttendanceCsvRow = {
  first_name: string;
  last_name: string;
  discord: string | null;
  personal_email: string | null;
  cougarnet_email: string | null;
  attended_at?: string | null;
};

export async function importEventAttendanceCsv(
  eventId: number,
  rows: AttendanceCsvRow[]
): Promise<
  | { ok: true; inserted_events_attendance: number; inserted_unassigned: number }
  | { ok: false; error: string }
> {
  const gate = await requireManageEvents();
  if (!gate.ok) return { ok: false, error: gate.error };

  // Use the session-carrying server client so the SQL function can enforce manage_events
  // via current_user_has_permission() + auth.uid().
  const supabase = await createClient();

  if (!Number.isFinite(eventId) || eventId <= 0) {
    return { ok: false, error: "Invalid event id." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "No CSV rows to import." };
  }
  if (rows.length > 5000) {
    return { ok: false, error: "CSV import is limited to 5000 rows per upload." };
  }

  const payload = rows.map((r) => ({
    first_name: String(r.first_name ?? "").trim(),
    last_name: String(r.last_name ?? "").trim(),
    discord: r.discord ? String(r.discord).trim() : null,
    personal_email: r.personal_email ? String(r.personal_email).trim() : null,
    cougarnet_email: r.cougarnet_email ? String(r.cougarnet_email).trim() : null,
    attended_at: r.attended_at ? String(r.attended_at).trim() : null,
  }));

  const { data, error } = await supabase.rpc(
    "import_event_attendance_from_json",
    {
      p_event_id: eventId,
      p_attendees: payload,
    }
  );

  if (error) return { ok: false, error: error.message };

  const first = Array.isArray(data) ? data[0] : data;
  const inserted_events_attendance = Number(
    (first as { inserted_events_attendance?: unknown } | null)
      ?.inserted_events_attendance ?? 0
  );
  const inserted_unassigned = Number(
    (first as { inserted_unassigned?: unknown } | null)?.inserted_unassigned ?? 0
  );

  revalidatePath("/dashboard/events/manage");
  return {
    ok: true,
    inserted_events_attendance,
    inserted_unassigned,
  };
}
