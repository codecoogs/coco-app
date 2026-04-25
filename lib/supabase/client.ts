import { createBrowserClient } from "@supabase/ssr";
import { supabaseBrowserCookieOptions } from "./cookie-options";
import { getSupabaseAnonKey, getSupabaseUrl } from "./public-env";

/**
 * Client Components: session in cookies (not localStorage). Tokens readable to JS only
 * when written from the browser (httpOnly: false); server/proxy use httpOnly.
 */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: supabaseBrowserCookieOptions,
    auth: {
      // Skip navigator.locks in the browser. Orphaned locks + acquire timeouts surface as
      // AbortError in auth-js (common with React Strict Mode / Turbopack fast refresh).
      // Session refresh still runs in proxy (Node), which does not use Web Locks.
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
  });
}
