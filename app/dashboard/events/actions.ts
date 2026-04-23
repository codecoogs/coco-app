"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
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
  revalidatePath("/dashboard/events");
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
  revalidatePath("/dashboard/events");
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
  revalidatePath("/dashboard/events");
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
  revalidatePath("/dashboard/events");
  return { error: null };
}
