import { createProxySupabaseClient } from "@/lib/supabase/proxy-client";
import { forwardSessionCookies } from "@/lib/supabase/forward-session-cookies";
import { NextResponse, type NextRequest } from "next/server";

// Proxy always runs on Node.js in Next.js 16+, so local Supabase (e.g. 127.0.0.1:54321) refresh works in dev.

const PROTECTED_PATHS = ['/dashboard']
const AUTH_PATHS = ['/login', '/signup', '/auth/team', '/forgot-password']

function isProtected(pathname: string) {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Owns its own auth entirely (exchanges the OAuth code and writes the
  // session cookies itself). Running getUser() here first - before that
  // exchange happens - finds no session yet; GoTrue's response to that can
  // write cookie-clearing Set-Cookie headers onto this response, which Next
  // merges onto the callback route's own redirect afterward. Depending on
  // header order that can wipe the session /auth/callback just established,
  // so the very next request to /dashboard finds no user and bounces back
  // to /login - exactly the "Discord sign-in redirects me back to sign in"
  // symptom this fixes.
  if (pathname.startsWith('/auth/callback')) {
    return NextResponse.next({ request })
  }

  const response = NextResponse.next({ request })

  const supabase = createProxySupabaseClient(request, response)

  // Refreshes expired access tokens (refresh token rotation) and writes updated cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isProtected(pathname) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    const redirect = NextResponse.redirect(url)
    forwardSessionCookies(response, redirect)
    return redirect
  }

  if ((pathname === '/' || isAuthPath(pathname)) && user) {
    // Invite / finish-signup: email link lands with session + signup modal (see lib/auth-internal-path)
    if (pathname === '/' && request.nextUrl.searchParams.get('modal') === 'signup') {
      return response
    }
    // /signup redirects to ?modal=signup; allow through so invited users are not sent to dashboard first
    if (pathname === '/signup') {
      return response
    }
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    const redirect = NextResponse.redirect(url)
    forwardSessionCookies(response, redirect)
    return redirect
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
