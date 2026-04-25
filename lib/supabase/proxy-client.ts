import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseServerCookieOptions } from "./cookie-options";
import { getSupabaseAnonKey, getSupabaseUrl } from "./public-env";

/**
 * Supabase client for root proxy: reads request cookies, writes refreshed session
 * onto the response (access/refresh tokens via chunked cookies, httpOnly on server).
 */
export function createProxySupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: supabaseServerCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
}
