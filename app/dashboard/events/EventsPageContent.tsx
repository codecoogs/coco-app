"use client";

import { useCallback, useEffect, useState } from "react";

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
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function statusTone(status: string | null | undefined) {
  const v = (status ?? "").trim().toLowerCase();
  if (v === "cancelled") {
    return "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300";
  }
  if (v === "scheduled") {
    return "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function EventsPageContent({
  initialEvents,
}: {
  initialEvents: EventsPublicRow[];
}) {
  const events = initialEvents;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex((i) => (events.length === 0 ? 0 : Math.min(i, events.length - 1)));
  }, [events.length]);

  const current = events[index] ?? null;

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

  return (
    <div className="flex flex-col gap-6 lg:gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Events</h1>
        <p className="mt-1 text-muted-foreground">
          Upcoming public events — arrows, dots, or keyboard (← →).
        </p>
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
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
              aria-roledescription="carousel"
              aria-label="Public events carousel"
            >
              {/* Meta on top */}
              <header className="border-b border-border bg-muted/40 px-4 py-4 sm:px-5">
                <h2 className="text-center text-xl font-semibold tracking-tight text-card-foreground sm:text-2xl">
                  {current?.title ?? "Event"}
                </h2>
                <div className="mt-3 flex justify-center">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusTone(
                      current?.status,
                    )}`}
                  >
                    {(current?.status ?? "scheduled").replaceAll("_", " ")}
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
                  aria-selected={i === index}
                  aria-label={`Show event: ${e.title}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === index
                      ? "w-8 bg-accent"
                      : "w-2 bg-muted-foreground/35 hover:bg-muted-foreground/60"
                  }`}
                />
              ))}
            </div>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Nearest upcoming first · {index + 1} of {events.length}
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
