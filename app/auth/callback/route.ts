import { sanitizeAuthNextParam } from "@/lib/auth-internal-path";
import { getSiteUrl } from "@/lib/site-url";
import { supabaseServerCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/public-env";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeAuthNextParam(searchParams.get("next"));
  const baseUrl = getSiteUrl(origin);

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        cookieOptions: supabaseServerCookieOptions,
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
}