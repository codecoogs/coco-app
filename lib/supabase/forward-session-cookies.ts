import type { NextResponse } from "next/server";

/**
 * After refreshing the session, Supabase sets cookies on `sessionResponse`. If the
 * proxy returns a different NextResponse (e.g. redirect), those Set-Cookie headers
 * must be forwarded or the refresh is lost.
 */
export function forwardSessionCookies(
  sessionResponse: NextResponse,
  target: NextResponse
): void {
  const list = sessionResponse.headers.getSetCookie();
  for (const cookie of list) {
    target.headers.append("Set-Cookie", cookie);
  }
}
