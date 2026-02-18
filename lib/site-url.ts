/**
 * Base URL for auth redirects (OAuth, email confirmation, password reset).
 * Set NEXT_PUBLIC_SITE_URL in .env.local for development (e.g. http://localhost:3000)
 * and in production so redirects work correctly with local-first Supabase.
 *
 * Next.js loads .env.local automatically in development and overrides .env.
 */
export function getSiteUrl(serverFallback?: string): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") return window.location.origin;
  return serverFallback ?? "";
}
