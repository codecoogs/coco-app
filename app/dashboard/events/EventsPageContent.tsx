"use client";

import { compareAsc, isPast, parseISO } from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";

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

const PAGE_SIZE = 10;

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function EventsPageContent({
  initialEvents,
}: {
  initialEvents: EventsPublicRow[];
}) {
  const [q, setQ] = useState("");
  const [hidePast, setHidePast] = useState(false);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = [...initialEvents];
    if (hidePast) {
      list = list.filter((e) => {
        if (!e.start_time) return true;
        return !isPast(parseISO(e.start_time));
      });
    }
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter((e) => {
        return (
          (e.title ?? "").toLowerCase().includes(s) ||
          (e.location ?? "").toLowerCase().includes(s) ||
          (e.description ?? "").toLowerCase().includes(s)
        );
      });
    }
    list.sort((a, b) => {
      if (!a.start_time && !b.start_time) return 0;
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return compareAsc(parseISO(a.start_time), parseISO(b.start_time));
    });
    return list;
  }, [hidePast, initialEvents, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);
  const safePage = Math.min(page, pageCount - 1);
  const slice = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          <p className="mt-1 text-muted-foreground">
            Upcoming events, flyers, and details.
          </p>
        </div>
        <Link
          href="/dashboard/events/manage"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Events management →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="w-full max-w-md">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Search
          </label>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Title, location, description…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={hidePast}
            onChange={(e) => {
              setHidePast(e.target.checked);
              setPage(0);
            }}
            className="rounded border-border"
          />
          Hide past events
        </label>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">
            Event list
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Title
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Start
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Location
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Flyer
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {slice.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No events match.
                  </td>
                </tr>
              ) : (
                slice.map((e) => (
                  <tr key={e.id} className="hover:bg-muted">
                    <td className="px-4 py-3 text-sm text-card-foreground sm:px-6">
                      <div className="font-medium">{e.title}</div>
                      {e.status === "cancelled" ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Cancelled
                        </div>
                      ) : null}
                      {!e.is_public ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Private
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatWhen(e.start_time)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {e.location || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6">
                      {e.flyer_url ? (
                        <a
                          href={e.flyer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-6">
          <p className="text-sm text-muted-foreground">
            Page {safePage + 1} of {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage <= 0}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

