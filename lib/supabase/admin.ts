import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client that uses the service_role key.
 * Bypasses RLS. Use only in server code after verifying the user is
 * authenticated and authorized (e.g. has view_officers / manage_officers).
 *
 * Do not use for auth.getUser() — use the regular server client for that.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
