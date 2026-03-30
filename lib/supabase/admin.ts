import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "./public-env";

/**
 * Server-only Supabase client that uses the service_role key.
 * Bypasses RLS. Use only in server code after verifying the user is
 * authenticated and authorized (e.g. has view_officers / manage_officers).
 *
 * Do not use for auth.getUser() — use the regular server client for that.
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
