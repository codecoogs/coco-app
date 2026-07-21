import type { CookieOptions } from "@supabase/ssr";

const isProd = process.env.NODE_ENV === "production";

/**
 * Shared options for Supabase auth cookies across browser, server, and proxy writers.
 *
 * httpOnly must stay false and identical everywhere: the proxy (middleware) rewrites
 * these cookies on nearly every request, and if it ever writes httpOnly while the
 * browser client writes non-httpOnly (or vice versa), whichever wrote last wins and the
 * other side loses read access to the cookie entirely -- document.cookie cannot see
 * httpOnly cookies at all. That mismatch previously caused the client-side session
 * (ProfileContext) to intermittently see no session ("Session unavailable") even though
 * the server-side checks (proxy, dashboard layout) still saw a valid one, since httpOnly
 * only blocks JS access, not server-side cookie reads. httpOnly buys no real XSS
 * protection here anyway, since the browser Supabase client must read the token from JS
 * to attach it to client-side requests -- so there's nothing an XSS payload couldn't
 * already get via the SDK itself.
 *
 * Note: @supabase/ssr (0.8.x) ignores any `maxAge` passed here for the actual session
 * cookie writes and always uses its own ~400-day default (browser cookie max lifetime).
 * Session duration is controlled by Supabase Auth's own session settings
 * (supabase/config.toml `[auth.sessions]` locally; Dashboard > Authentication > Sessions
 * for the hosted project), not by this cookie's maxAge.
 */
export const supabaseCookieOptions: Pick<
  CookieOptions,
  "path" | "sameSite" | "secure" | "httpOnly"
> = {
  path: "/",
  sameSite: "lax",
  secure: isProd,
  httpOnly: false,
};
