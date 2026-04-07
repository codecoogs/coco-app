/**
 * Safe internal redirect target after /auth/callback (open-redirect hardening).
 * Allows paths like /dashboard, /reset-password, /?modal=signup&from=invite
 */
export function sanitizeAuthNextParam(next: string | null): string {
  const fallback = "/dashboard";
  if (next == null || typeof next !== "string") return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://") || trimmed.includes("\\")) return fallback;
  return trimmed;
}

/** Use as Supabase invite email redirect: auth/callback?next=encodeURIComponent(...) */
export const INVITE_SIGNUP_CALLBACK_NEXT = "/?modal=signup&from=invite";

/**
 * Full `redirectTo` for `inviteUserByEmail` (or Dashboard invite), using the same origin as `getSiteUrl()`.
 * Add this exact URL (or its pattern) to Supabase Auth redirect allowlist.
 */
export function inviteEmailRedirectTo(siteRoot: string): string {
  const base = siteRoot.replace(/\/$/, "");
  const next = encodeURIComponent(
    sanitizeAuthNextParam(INVITE_SIGNUP_CALLBACK_NEXT)
  );
  return `${base}/auth/callback?next=${next}`;
}
