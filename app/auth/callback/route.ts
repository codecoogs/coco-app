import { sanitizeAuthNextParam } from "@/lib/auth-internal-path";
import { getSiteUrl } from "@/lib/site-url";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { forwardSessionCookies } from "@/lib/supabase/forward-session-cookies";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/public-env";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Discord (and other) OAuth return URL. exchangeCodeForSession writes chunked
 * session cookies; those must be copied onto the redirect response (same
 * pattern as proxy + forwardSessionCookies) or the browser never stores
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
      cookieOptions: supabaseCookieOptions,
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

  const { data: exchangeData, error } =
    await supabase.auth.exchangeCodeForSession(code);

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

  // Send straight to the executive dashboard in this same response when the
  // default destination applies, instead of landing on /dashboard and
  // relying on its own server-side redirect to bounce again. That second
  // hop is a full extra request back through the proxy (another
  // getUser() call) moments after this one just minted the session - the
  // reload-fixes-it flakiness reported for exec accounts right after
  // Discord sign-in traces to that race window. An explicit next (e.g.
  // /dashboard/settings from the Discord-link flow in DiscordLinkSection)
  // is left untouched. /dashboard still redirects on its own for direct
  // navigation there (sidebar link, bookmark, etc).
  let finalNext = next;
  if (next === "/dashboard" && exchangeData.user) {
    const profile = await fetchUserProfile(supabase, exchangeData.user.id);
    if (hasPermission(profile, "view_executive_dashboard")) {
      finalNext = "/dashboard/executive";
    }
  }

  const redirect = NextResponse.redirect(`${baseUrl}${finalNext}`);
  forwardSessionCookies(sessionResponse, redirect);
  return redirect;
}
