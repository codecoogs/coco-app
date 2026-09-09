"use client";

import {
  canAddToCalendar,
  googleCalendarUrl,
  icsFileContent,
} from "@/lib/calendar-link";
import {
  EVENT_STATE_LABEL,
  EVENT_STATE_TONE,
  getEventState,
} from "@/lib/event-status";
import { formatEventDateTime } from "@/lib/event-time";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type EventsPublicRow = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  flyer_url: string | null;
  is_public: boolean;
  status: string;
};

function formatWhen(iso: string | null) {
  return formatEventDateTime(iso, {
    dateStyle: undefined,
    timeStyle: undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function downloadIcs(event: EventsPublicRow) {
  if (!event.start_time || !event.end_time) return;
  const ics = icsFileContent({
    title: event.title,
    description: event.description,
    location: event.location,
    start_time: event.start_time,
    end_time: event.end_time,
  });
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9-_]/g, "_") || "event"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EventsPageContent({
  initialEvents,
}: {
  initialEvents: EventsPublicRow[];
}) {
  const events = initialEvents;
  const [index, setIndex] = useState(0);

  const safeIndex = events.length === 0 ? 0 : Math.min(index, events.length - 1);
  const current = events[safeIndex] ?? null;
  // Derived per render rather than stored: an event becomes "active" purely by
  // the clock passing its start time.
  const currentState = useMemo(() => getEventState(current ?? {}), [current]);

  const go = useCallback(
    (delta: number) => {
      if (events.length === 0) return;
      const n = events.length;
      setIndex((i) => (((i + delta) % n) + n) % n);
    },
    [events.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Swipe navigation for touch devices, mirroring the Previous/Next buttons.
  const touchStartX = useRef<number | null>(null);
  const SWIPE_THRESHOLD_PX = 40;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;
      if (delta <= -SWIPE_THRESHOLD_PX) go(1);
      else if (delta >= SWIPE_THRESHOLD_PX) go(-1);
    },
    [go],
  );

  return (
    <div className="flex flex-col gap-6 lg:gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Events</h1>
      </div>

      {events.length === 0 ? (
        <div className="flex min-h-[32vh] flex-col items-center justify-center px-4 text-center lg:min-h-[28vh]">
          <div className="max-w-md rounded-2xl border border-border bg-card px-8 py-12 shadow-sm">
            <p className="text-lg font-medium text-card-foreground">
              No upcoming public events
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              When new events are announced, they&apos;ll show up here with a
              poster if one is available.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center px-4 pb-0 sm:px-6">
          <div className="w-full max-w-sm">
            <article
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg touch-pan-y"
              aria-roledescription="carousel"
              aria-label="Public events carousel"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* Meta on top */}
              <header className="border-b border-border bg-muted/40 px-4 py-4 sm:px-5">
                <h2 className="text-center text-xl font-semibold tracking-tight text-card-foreground sm:text-2xl">
                  {current?.title ?? "Event"}
                </h2>
                <div className="mt-3 flex justify-center">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                      EVENT_STATE_TONE[currentState]
                    }`}
                  >
                    {EVENT_STATE_LABEL[currentState]}
                  </span>
                </div>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {formatWhen(current?.start_time ?? null)}
                </p>
                <p className="mt-2 text-center text-sm font-medium text-foreground">
                  <span className="text-muted-foreground">Where: </span>
                  {(current?.location ?? "").trim() || (
                    <span className="font-normal text-muted-foreground">
                      Location to be announced
                    </span>
                  )}
                </p>
              </header>

              {/* Poster — movie poster ratio */}
              <div className="relative aspect-2/3 w-full overflow-hidden bg-muted">
                {current?.flyer_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Flyer URLs come from storage / external hosts
                  <img
                    src={current.flyer_url}
                    alt=""
                    className="h-full w-full object-cover object-center"
                  />
                ) : (
                  <PosterPlaceholder title={current?.title ?? "Event"} />
                )}
              </div>
            </article>

            {current && canAddToCalendar(current) ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <a
                  href={googleCalendarUrl({
                    title: current.title,
                    description: current.description,
                    location: current.location,
                    start_time: current.start_time!,
                    end_time: current.end_time!,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
                >
                  Add to calendar
                </a>
                <button
                  type="button"
                  onClick={() => downloadIcs(current)}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
                >
                  Download .ics
                </button>
              </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-2 sm:gap-4">
              <button
                type="button"
                aria-label="Previous event"
                onClick={() => go(-1)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium shadow-sm transition hover:bg-muted sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <ChevronLeftIcon />
                Previous
              </button>
              <button
                type="button"
                aria-label="Next event"
                onClick={() => go(1)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium shadow-sm transition hover:bg-muted sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                Next
                <ChevronRightIcon />
              </button>
            </div>

            {/* Dots */}
            <div
              className="mt-4 flex flex-wrap justify-center gap-2"
              role="tablist"
              aria-label="Event slides"
            >
              {events.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  role="tab"
                  aria-selected={i === safeIndex}
                  aria-label={`Show event: ${e.title}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === safeIndex
                      ? "w-8 bg-accent"
                      : "w-2 bg-muted-foreground/35 hover:bg-muted-foreground/60"
                  }`}
                />
              ))}
            </div>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Nearest upcoming first · {safeIndex + 1} of {events.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PosterPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-linear-to-br from-muted to-muted/60 px-6 text-center">
      <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-background/70 px-4 py-3 shadow-inner">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          No poster uploaded
        </p>
        <p className="mt-1 text-sm font-medium leading-snug text-foreground">
          A flyer will appear here once it&apos;s added for this event.
        </p>
      </div>
      <p className="line-clamp-2 max-w-48 text-xs font-medium text-muted-foreground">
        {title}
      </p>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-foreground"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-foreground"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
