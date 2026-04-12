import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware-client";
import { forwardSessionCookies } from "@/lib/supabase/forward-session-cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Node.js runtime so `fetch` to local Supabase (e.g. http://127.0.0.1:54321) works in dev.
 * Edge/Turbopack sandbox often throws "Error: fetch failed" for localhost Auth refresh.
 */
export const runtime = 'nodejs'

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

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createMiddlewareSupabaseClient(request, response)

  // Refreshes expired access tokens (refresh token rotation) and writes updated cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  if (isProtected(pathname) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    const redirect = NextResponse.redirect(url)
    forwardSessionCookies(response, redirect)
    return redirect
  }

  // Let users on reset-password through so they can set a new password after the email link
  if (pathname === '/reset-password') {
    return response
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
