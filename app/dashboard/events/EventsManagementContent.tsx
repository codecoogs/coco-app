"use client";

import { compareAsc, isPast, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelEvent,
  getEvents,
  toggleEventPublic,
  type EventRow,
  type PointCategoryOption,
} from "./actions";
import { EventFormModal } from "./EventFormModal";

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

function formatEventPoints(row: EventRow) {
  if (row.point_category_points != null) {
    const pts = row.point_category_points;
    const name = row.point_category_name?.trim();
    return name ? `${pts} pts · ${name}` : `${pts} pts`;
  }
  if (row.point_category?.trim()) {
    return "Unknown category";
  }
  return "—";
}

type Props = {
  initialEvents: EventRow[];
  categories: PointCategoryOption[];
  canManage: boolean;
};

export function EventsManagementContent({
  initialEvents,
  categories,
  canManage,
}: Props) {
  const [events, setEvents] = useState(initialEvents);
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);
  const [hidePast, setHidePast] = useState(false);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; event: EventRow } | null
  >(null);

  const refresh = useCallback(async () => {
    const { data, error } = await getEvents();
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }
    setEvents(data);
  }, []);

  const rows = useMemo(() => {
    let list = [...events];
    if (hidePast) {
      list = list.filter((e) => {
        if (!e.start_time) return true;
        return !isPast(parseISO(e.start_time));
      });
    }
    list.sort((a, b) => {
      if (!a.start_time && !b.start_time) return 0;
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      const c = compareAsc(parseISO(a.start_time), parseISO(b.start_time));
      return sortDir === "asc" ? c : -c;
    });
    return list;
  }, [events, hidePast, sortDir]);

  const toggleSort = useCallback(() => {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }, []);

  const handleTogglePublic = useCallback(
    async (id: number) => {
      setBusyId(id);
      setMessage(null);
      const { error } = await toggleEventPublic(id);
      setBusyId(null);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      await refresh();
    },
    [refresh],
  );

  const handleCancel = useCallback(
    async (id: number) => {
      if (
        !confirm("Cancel this event? It will stay in the list as cancelled.")
      ) {
        return;
      }
      setBusyId(id);
      setMessage(null);
      const { error } = await cancelEvent(id);
      setBusyId(null);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      await refresh();
    },
    [refresh],
  );

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={
            message.type === "error"
              ? "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
              : "rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
          }
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {canManage && (
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            New event
          </button>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={hidePast}
            onChange={(e) => setHidePast(e.target.checked)}
            className="rounded border-border"
          />
          Hide past events
        </label>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">Events</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {rows.length} event{rows.length !== 1 ? "s" : ""} shown
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
                  <button
                    type="button"
                    onClick={toggleSort}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Start time
                    <span className="text-[10px] normal-case text-muted-foreground">
                      ({sortDir === "asc" ? "oldest first" : "newest first"})
                    </span>
                  </button>
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Points
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Visibility
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Status
                </th>
                {canManage && (
                  <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 6 : 5}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No events match the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const cancelled = row.status === "cancelled";
                  return (
                    <tr
                      key={row.id}
                      className={
                        cancelled
                          ? "bg-muted/40 opacity-80 hover:bg-muted/50"
                          : "hover:bg-muted"
                      }
                    >
                      <td className="px-4 py-3 text-sm text-card-foreground sm:px-6">
                        <span className="font-medium">{row.title}</span>
                        {row.flyer_url ? (
                          <a
                            href={row.flyer_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-xs text-blue-600 dark:text-blue-400"
                          >
                            Flyer
                          </a>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                        {formatWhen(row.start_time)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                        {formatEventPoints(row)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                        {row.is_public ? "Public" : "Private"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 sm:px-6">
                        {cancelled ? (
                          <span className="inline-flex rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
                            Cancelled
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Active
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm sm:px-6">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() =>
                                setModal({ mode: "edit", event: row })
                              }
                              className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => handleTogglePublic(row.id)}
                              className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                            >
                              {row.is_public ? "Make private" : "Make public"}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id || cancelled}
                              onClick={() => handleCancel(row.id)}
                              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              Cancel event
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal?.mode === "create" && (
        <EventFormModal
          mode="create"
          event={null}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
      {modal?.mode === "edit" && (
        <EventFormModal
          key={modal.event.id}
          mode="edit"
          event={modal.event}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
