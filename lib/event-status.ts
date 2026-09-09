/**
 * Event state shown in the UI.
 *
 * Only `cancelled` is stored. "Active" is a fact about the clock, not about the
 * row - storing it would need a job flipping every event on at its start time
 * and off at its end, and any missed run would leave the badge lying. Deriving
 * it costs nothing and is always right.
 *
 * Rows created before this was settled still carry status 'active' in the
 * database; they are treated as not-cancelled and derive like anything else, so
 * no backfill is needed.
 */
export type EventState = "cancelled" | "active" | "scheduled" | "ended";

export type EventStateInput = {
  status?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export function getEventState(
  event: EventStateInput,
  now: Date = new Date()
): EventState {
  if ((event.status ?? "").trim().toLowerCase() === "cancelled") {
    return "cancelled";
  }

  const start = event.start_time ? new Date(event.start_time) : null;
  const end = event.end_time ? new Date(event.end_time) : null;
  const ms = now.getTime();

  if (start && end && ms >= start.getTime() && ms <= end.getTime()) {
    return "active";
  }
  if (end && ms > end.getTime()) return "ended";
  return "scheduled";
}

export const EVENT_STATE_LABEL: Record<EventState, string> = {
  cancelled: "Cancelled",
  active: "Active",
  scheduled: "Scheduled",
  ended: "Ended",
};

export const EVENT_STATE_TONE: Record<EventState, string> = {
  cancelled:
    "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
  active:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  scheduled:
    "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  ended: "border-border bg-muted text-muted-foreground",
};
