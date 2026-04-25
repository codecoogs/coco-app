import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseServerCookieOptions } from "./cookie-options";
import { getSupabaseAnonKey, getSupabaseUrl } from "./public-env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: supabaseServerCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore in Server Components (read-only); proxy refreshes session.
        }
      },
    },
  });
}
