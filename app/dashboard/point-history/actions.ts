"use server";

import { createClient } from "@/lib/supabase/server";
import type { PointHistoryBundle } from "./queries";
import { fetchPointHistoryForSignedInUser } from "./server-queries";

export async function refreshPointHistory(): Promise<{
  data: PointHistoryBundle | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { data: null, error: "Not signed in." };
  }
  const { data, error, hasLinkedProfile } = await fetchPointHistoryForSignedInUser(
    supabase,
    { id: user.id, email: user.email }
  );
  if (!hasLinkedProfile) {
    return { data: null, error: "Could not find your member profile." };
  }
  if (error) return { data: null, error };
  return { data, error: null };
}
