import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "./middleware-client";

/** @deprecated Prefer importing createMiddlewareSupabaseClient from ./middleware-client in middleware.ts */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createMiddlewareSupabaseClient(request, response);
  await supabase.auth.getUser();
  return response;
}
