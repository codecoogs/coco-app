import { createBrowserClient } from "@supabase/ssr";
import { supabaseCookieOptions } from "./cookie-options";
import { getSupabaseAnonKey, getSupabaseUrl } from "./public-env";

/**
 * Client Components: session in cookies (not localStorage), via document.cookie.
 * See supabaseCookieOptions for why httpOnly must stay false and consistent with
 * the server/proxy clients.
 */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: supabaseCookieOptions,
    auth: {
      // Skip navigator.locks in the browser. Orphaned locks + acquire timeouts surface as
      // AbortError in auth-js (common with React Strict Mode / Turbopack fast refresh).
      // Session refresh still runs in proxy (Node), which does not use Web Locks.
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
  });
}
