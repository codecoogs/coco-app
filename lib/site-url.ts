/**
 * Base URL for auth redirects (OAuth, email confirmation, password reset)
 * and server-side absolute-URL construction (e.g. Stripe success/cancel
 * URLs). Set NEXT_PUBLIC_SITE_URL in .env.local for development (e.g.
 * http://localhost:3000) and in production so redirects work correctly with
 * local-first Supabase.
 *
 * Next.js loads .env.local automatically in development and overrides .env.
 *
 * If NEXT_PUBLIC_SITE_URL is missing in a server context (no `window`), this
 * falls back to `serverFallback` if the caller passed one (e.g. the current
 * request's origin), then to Vercel's auto-provided VERCEL_URL, rather than
 * silently returning "" - an empty base turns absolute URLs into relative
 * paths, which breaks anything that requires a fully-qualified URL (Stripe
 * rejects a relative success_url/cancel_url outright).
 */
export function getSiteUrl(serverFallback?: string): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") return window.location.origin;
  if (serverFallback) return serverFallback;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}
