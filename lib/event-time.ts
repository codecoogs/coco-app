/**
 * Club-local timezone. Every event happens on the UH campus, so event times are
 * always shown in Central regardless of where the viewer (or the server) is.
 *
 * Without pinning this, `toLocaleString(undefined, ...)` resolves to whatever
 * timezone the code happens to run in - the browser's on the client, but UTC in
 * a server component on Vercel. That split had the same event reading 5:40 PM on
 * the events page and 10:40 PM on the dashboard card.
 */
export const CLUB_TIME_ZONE = "America/Chicago";

/** Date + time, e.g. "Sep 8, 2026, 5:40 PM". */
export function formatEventDateTime(
  iso: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      ...options,
      timeZone: CLUB_TIME_ZONE,
    });
  } catch {
    return "—";
  }
}
