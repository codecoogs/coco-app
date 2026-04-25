import type { CookieOptions } from "@supabase/ssr";

const isProd = process.env.NODE_ENV === "production";

/**
 * Options for Supabase auth cookies when set by the server (Route Handlers, Server Actions,
 * Server Components where set succeeds) and proxy. httpOnly keeps tokens out of JS
 * (XSS); browsers still send these cookies on same-origin requests to the app.
 */
export const supabaseServerCookieOptions: Pick<
  CookieOptions,
  "path" | "sameSite" | "secure" | "httpOnly"
> = {
  path: "/",
  sameSite: "lax",
  secure: isProd,
  httpOnly: true,
};

/**
 * Browser Supabase client uses document.cookie; HttpOnly cannot be set from JS and would
 * not be readable. Path/sameSite/secure stay aligned with the server so proxy can
 * refresh sessions into httpOnly cookies on the next navigation.
 */
export const supabaseBrowserCookieOptions: Pick<
  CookieOptions,
  "path" | "sameSite" | "secure" | "httpOnly"
> = {
  path: "/",
  sameSite: "lax",
  secure: isProd,
  httpOnly: false,
};
