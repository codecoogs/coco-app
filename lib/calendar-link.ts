/**
 * "Add to calendar" links. Title, description and location only - the flyer and
 * point category are deliberately left out.
 *
 * Two options because one does not cover everyone: the Google URL opens a
 * prefilled event for Google users, and the .ics file is what Apple Calendar
 * and Outlook understand.
 */

export type CalendarEvent = {
  title: string;
  description?: string | null;
  location?: string | null;
  start_time: string;
  end_time: string;
};

/** Calendar wire format: 20260914T223000Z */
function toCalendarUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// ponytail: Google truncates very long URLs; 1500 chars of description is far
// more than any event here uses. Raise it if a real event ever gets clipped.
const MAX_DESCRIPTION = 1500;

function trimmed(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, MAX_DESCRIPTION);
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toCalendarUtc(event.start_time)}/${toCalendarUtc(event.end_time)}`,
  });
  const details = trimmed(event.description);
  const location = trimmed(event.location);
  if (details) params.set("details", details);
  if (location) params.set("location", location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** RFC 5545: escape , ; and newlines, and fold nothing (lines stay short here). */
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function icsFileContent(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CodeCoogs//Coco//EN",
    "BEGIN:VEVENT",
    `UID:${toCalendarUtc(event.start_time)}-${Math.random().toString(36).slice(2)}@codecoogs`,
    `DTSTAMP:${toCalendarUtc(new Date().toISOString())}`,
    `DTSTART:${toCalendarUtc(event.start_time)}`,
    `DTEND:${toCalendarUtc(event.end_time)}`,
    `SUMMARY:${icsEscape(event.title)}`,
  ];
  const details = trimmed(event.description);
  const location = trimmed(event.location);
  if (details) lines.push(`DESCRIPTION:${icsEscape(details)}`);
  if (location) lines.push(`LOCATION:${icsEscape(location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** True when both times exist - without them neither link can be built. */
export function canAddToCalendar(event: {
  start_time?: string | null;
  end_time?: string | null;
}): boolean {
  return Boolean(event.start_time && event.end_time);
}
