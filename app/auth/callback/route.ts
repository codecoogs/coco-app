import { sanitizeAuthNextParam } from "@/lib/auth-internal-path";
import { getSiteUrl } from "@/lib/site-url";
import { supabaseServerCookieOptions } from "@/lib/supabase/cookie-options";
import { forwardSessionCookies } from "@/lib/supabase/forward-session-cookies";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/public-env";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Discord (and other) OAuth return URL. exchangeCodeForSession writes chunked
 * httpOnly session cookies; those must be copied onto the redirect response
 * (same pattern as proxy + forwardSessionCookies) or the browser never stores
 * access/refresh tokens after OAuth.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeAuthNextParam(searchParams.get("next"));
  const baseUrl = getSiteUrl(origin);

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
  }

  let sessionResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookieOptions: supabaseServerCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          sessionResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            sessionResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
  }

  const { error: profileSyncError } = await supabase.rpc(
    "sync_oauth_profile_to_public_user",
  );
  if (profileSyncError) {
    console.error(
      "[auth/callback] sync_oauth_profile_to_public_user:",
      profileSyncError.message,
    );
  }

  const redirect = NextResponse.redirect(`${baseUrl}${next}`);
  forwardSessionCookies(sessionResponse, redirect);
  return redirect;
}
