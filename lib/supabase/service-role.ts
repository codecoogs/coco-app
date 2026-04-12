import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "./public-env";

/**
 * Service-role client for server actions, or null if the key is missing.
 * Prefer this over throwing when you can return a user-visible error.
 */
export function getServiceRoleClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
