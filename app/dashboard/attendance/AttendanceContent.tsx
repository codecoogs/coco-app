"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { mintCheckInToken, type ActiveEvent } from "./actions";

type Props = {
  events: ActiveEvent[];
  /** Absolute origin, so the QR resolves on a phone rather than on localhost. */
  origin: string;
};

function formatWindow(event: ActiveEvent): string {
  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString(undefined, { timeStyle: "short" }) : "—";
  return `${time(event.start_time)} – ${time(event.end_time)}`;
}

export function AttendanceContent({ events, origin }: Props) {
  const [selected, setSelected] = useState<ActiveEvent | null>(
    events.length === 1 ? events[0] : null
  );
  // Keyed by event so a QR minted for a previous selection is never shown for
  // the current one - which also means no state has to be cleared on switch.
  const [qr, setQr] = useState<{ eventId: number; dataUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!selected) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Re-mints as each window rolls over rather than on a fixed interval, so
    // the code on screen and the code the server accepts stay in step even if
    // the browser clock drifts or a tab is throttled.
    const tick = async () => {
      const { token, expiresInMs, error: mintError } = await mintCheckInToken(selected.id);
      if (cancelled) return;
      if (mintError) {
        setError(mintError);
        return;
      }
      const url = `${origin}/checkin/${selected.id}?t=${encodeURIComponent(token)}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 720,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      if (cancelled) return;
      setQr({ eventId: selected.id, dataUrl });
      setError(null);
      timer = setTimeout(() => void tick(), expiresInMs);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selected, origin]);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        No events are running right now. A check-in code appears here once an
        event starts.
      </div>
    );
  }

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{selected.title}</h2>
            <p className="text-sm text-muted-foreground">
              {formatWindow(selected)}
              {selected.location ? ` · ${selected.location}` : ""}
            </p>
          </div>
          {events.length > 1 ? (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted"
            >
              Pick another event
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
            {qr && qr.eventId === selected.id ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL that changes every 15s; the image optimizer cannot help.
              <img
                src={qr.dataUrl}
                alt={`Check-in code for ${selected.title}`}
                className="aspect-square w-full max-w-[min(70vh,32rem)] rounded-lg bg-white p-3"
              />
            ) : (
              <div className="aspect-square w-full max-w-[min(70vh,32rem)] animate-pulse rounded-lg bg-muted" />
            )}
            <p className="text-center text-sm text-muted-foreground">
              This code refreshes every 15 seconds. A photo of it stops working
              almost immediately, so attendees have to scan it here.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {events.map((event) => (
        <li key={event.id}>
          <button
            type="button"
            onClick={() => setSelected(event)}
            className="w-full rounded-xl border border-border bg-card p-5 text-left shadow-sm hover:bg-muted"
          >
            <p className="font-semibold text-card-foreground">{event.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatWindow(event)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
