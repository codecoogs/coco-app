import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleClient } from "./service-role";

/**
 * Server-only Supabase client that uses the service_role key.
 * Bypasses RLS. Use only in server code after verifying the user is
 * authenticated and authorized (e.g. has view_officers / manage_officers).
 *
 * Do not use for auth.getUser() — use the regular server client for that.
 *
 * Prefer {@link getServiceRoleClient} when you can return an error instead of throwing.
 */
export function createAdminClient(): SupabaseClient {
  const client = getServiceRoleClient();
  if (!client) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return client;
}
