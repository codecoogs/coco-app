"use client";

import { compareAsc, isPast, parseISO } from "date-fns";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelEvent,
  getEvents,
  getEventsAttendanceBulk,
  getUnassignedAttendanceBulk,
  toggleEventPublic,
  type EventAttendanceBulkRow,
  type EventRow,
  type PointCategoryOption,
  type UnassignedAttendanceRow,
} from "./actions";
import { AddEventAttendanceModal } from "./AddEventAttendanceModal";
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

function formatAttendedAt(iso: string | null) {
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

const ATTENDANCE_DETAIL_PAGE_SIZE = 15;

type AttendanceDisplayRow =
  | {
      kind: "registered";
      id: string;
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      attended_at: string | null;
    }
  | {
      kind: "unassigned";
      id: string;
      first_name: string;
      last_name: string;
      discord: string | null;
      personal_email: string | null;
      cougarnet_email: string | null;
      is_user: boolean;
      attended_at: string | null;
    };

function rowMatchesPersonSearch(row: AttendanceDisplayRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  if (row.kind === "registered") {
    return (
      (row.first_name ?? "").toLowerCase().includes(s) ||
      (row.last_name ?? "").toLowerCase().includes(s) ||
      (row.email ?? "").toLowerCase().includes(s)
    );
  }
  return (
    row.first_name.toLowerCase().includes(s) ||
    row.last_name.toLowerCase().includes(s) ||
    (row.discord ?? "").toLowerCase().includes(s) ||
    (row.personal_email ?? "").toLowerCase().includes(s) ||
    (row.cougarnet_email ?? "").toLowerCase().includes(s)
  );
}

function rowMatchesAttendeeType(
  row: AttendanceDisplayRow,
  filter: "all" | "member" | "unassigned",
): boolean {
  if (filter === "all") return true;
  if (filter === "member") return row.kind === "registered";
  return row.kind === "unassigned";
}

function rowMatchesUnassignedLink(
  row: AttendanceDisplayRow,
  link: "all" | "pending" | "linked",
): boolean {
  if (row.kind !== "unassigned") return true;
  if (link === "all") return true;
  if (link === "pending") return !row.is_user;
  return row.is_user;
}

function mergeAttendanceRowsForEvent(
  registered: EventAttendanceBulkRow[],
  unassigned: UnassignedAttendanceRow[],
): AttendanceDisplayRow[] {
  const reg: AttendanceDisplayRow[] = registered.map((r) => ({
    kind: "registered" as const,
    id: r.id,
    user_id: r.user_id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    attended_at: r.attended_at,
  }));
  const un: AttendanceDisplayRow[] = unassigned.map((u) => ({
    kind: "unassigned" as const,
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    discord: u.discord,
    personal_email: u.personal_email,
    cougarnet_email: u.cougarnet_email,
    is_user: u.is_user,
    attended_at: u.attended_at,
  }));
  const combined = [...reg, ...un];
  combined.sort((a, b) => {
    const la =
      (a.kind === "registered" ? a.last_name : a.last_name) ?? "";
    const lb =
      (b.kind === "registered" ? b.last_name : b.last_name) ?? "";
    const c = la.toLowerCase().localeCompare(lb.toLowerCase());
    if (c !== 0) return c;
    const fa =
      (a.kind === "registered" ? a.first_name : a.first_name) ?? "";
    const fb =
      (b.kind === "registered" ? b.first_name : b.first_name) ?? "";
    if (fa.toLowerCase() !== fb.toLowerCase()) {
      return fa.toLowerCase().localeCompare(fb.toLowerCase());
    }
    if (a.kind !== b.kind) return a.kind === "registered" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return combined;
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

  const [mainTab, setMainTab] = useState<"events" | "attendance">("events");
  const [attendanceRows, setAttendanceRows] = useState<
    EventAttendanceBulkRow[] | null
  >(null);
  const [unassignedRows, setUnassignedRows] = useState<
    UnassignedAttendanceRow[] | null
  >(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [expandedEventIds, setExpandedEventIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [attendanceEventSearch, setAttendanceEventSearch] = useState("");
  const [attendanceEventStatusFilter, setAttendanceEventStatusFilter] =
    useState<"all" | "active" | "cancelled">("all");
  const [attendeeTypeFilter, setAttendeeTypeFilter] = useState<
    "all" | "member" | "unassigned"
  >("all");
  const [unassignedLinkFilter, setUnassignedLinkFilter] = useState<
    "all" | "pending" | "linked"
  >("all");
  const [personSearch, setPersonSearch] = useState("");
  const [detailPageByEvent, setDetailPageByEvent] = useState<
    Record<number, number>
  >({});
  const [attendancePage, setAttendancePage] = useState(0);
  const PAGE_SIZE = 10;
  const [addAttendanceForEvent, setAddAttendanceForEvent] =
    useState<EventRow | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await getEvents();
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }
    setEvents(data);
    setAttendanceRows(null);
    setUnassignedRows(null);
  }, []);

  const reloadAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    setAttendanceError(null);
    const [reg, un] = await Promise.all([
      getEventsAttendanceBulk(),
      getUnassignedAttendanceBulk(),
    ]);
    setAttendanceLoading(false);
    const errs = [reg.error, un.error].filter(Boolean) as string[];
    if (errs.length) {
      setAttendanceError(errs.join(" "));
    } else {
      setAttendanceError(null);
    }
    setAttendanceRows(reg.error ? [] : reg.data);
    setUnassignedRows(un.error ? [] : un.data);
  }, []);

  useEffect(() => {
    if (mainTab !== "attendance") return;
    let cancelled = false;
    (async () => {
      setAttendanceLoading(true);
      setAttendanceError(null);
      const [reg, un] = await Promise.all([
        getEventsAttendanceBulk(),
        getUnassignedAttendanceBulk(),
      ]);
      if (cancelled) return;
      setAttendanceLoading(false);
      const errs = [reg.error, un.error].filter(Boolean) as string[];
      if (errs.length) {
        setAttendanceError(errs.join(" "));
        setAttendanceRows(reg.error ? [] : reg.data);
        setUnassignedRows(un.error ? [] : un.data);
        return;
      }
      setAttendanceError(null);
      setAttendanceRows(reg.data);
      setUnassignedRows(un.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [mainTab, events]);

  const attendanceByEvent = useMemo(() => {
    const m = new Map<number, EventAttendanceBulkRow[]>();
    for (const row of attendanceRows ?? []) {
      const list = m.get(row.event_id) ?? [];
      list.push(row);
      m.set(row.event_id, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const la = (a.last_name ?? "").toLowerCase();
        const lb = (b.last_name ?? "").toLowerCase();
        if (la !== lb) return la.localeCompare(lb);
        const fa = (a.first_name ?? "").toLowerCase();
        const fb = (b.first_name ?? "").toLowerCase();
        return fa.localeCompare(fb);
      });
    }
    return m;
  }, [attendanceRows]);

  const unassignedByEvent = useMemo(() => {
    const m = new Map<number, UnassignedAttendanceRow[]>();
    for (const row of unassignedRows ?? []) {
      const list = m.get(row.event_id) ?? [];
      list.push(row);
      m.set(row.event_id, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const la = a.last_name.toLowerCase();
        const lb = b.last_name.toLowerCase();
        if (la !== lb) return la.localeCompare(lb);
        return a.first_name.toLowerCase().localeCompare(b.first_name.toLowerCase());
      });
    }
    return m;
  }, [unassignedRows]);

  const toggleEventExpanded = useCallback((eventId: number) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
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

  const attendanceFilteredEvents = useMemo(() => {
    let list = [...rows];
    if (attendanceEventStatusFilter === "active") {
      list = list.filter((e) => e.status !== "cancelled");
    } else if (attendanceEventStatusFilter === "cancelled") {
      list = list.filter((e) => e.status === "cancelled");
    }
    const q = attendanceEventSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => {
      const t = (e.title ?? "").toLowerCase();
      const loc = (e.location ?? "").toLowerCase();
      return t.includes(q) || loc.includes(q);
    });
  }, [rows, attendanceEventSearch, attendanceEventStatusFilter]);

  const attendancePageCount = Math.max(
    1,
    Math.ceil(attendanceFilteredEvents.length / PAGE_SIZE) || 1,
  );
  const pagedAttendanceEvents = useMemo(() => {
    const page = Math.min(
      Math.max(0, attendancePage),
      Math.max(0, attendancePageCount - 1),
    );
    const start = page * PAGE_SIZE;
    return attendanceFilteredEvents.slice(start, start + PAGE_SIZE);
  }, [attendanceFilteredEvents, attendancePage, attendancePageCount]);

  useEffect(() => {
    setAttendancePage(0);
  }, [
    attendanceEventSearch,
    attendanceEventStatusFilter,
    rows,
    hidePast,
    sortDir,
  ]);

  useEffect(() => {
    setDetailPageByEvent({});
  }, [attendeeTypeFilter, unassignedLinkFilter, personSearch]);

  useEffect(() => {
    setAttendancePage((p) =>
      Math.min(p, Math.max(0, attendancePageCount - 1)),
    );
  }, [attendancePageCount, attendanceFilteredEvents.length]);

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

      <div
        className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
        role="tablist"
        aria-label="Event management sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === "events"}
          onClick={() => setMainTab("events")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            mainTab === "events"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Events
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === "attendance"}
          onClick={() => setMainTab("attendance")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            mainTab === "attendance"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Attendance
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {mainTab === "events" && canManage && (
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

      {mainTab === "attendance" && attendanceError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {attendanceError}
        </div>
      )}

      {mainTab === "events" && (
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
      )}

      {mainTab === "attendance" && (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="space-y-3 border-b border-border px-4 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">
                Attendance
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Expand an event to see who checked in.{" "}
                {attendanceFilteredEvents.length} event
                {attendanceFilteredEvents.length !== 1 ? "s" : ""} match
                {attendanceEventSearch.trim() ? " your search" : " the filters above"}.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="max-w-md flex-1">
                <label
                  htmlFor="attendance-event-search"
                  className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Search events
                </label>
                <input
                  id="attendance-event-search"
                  type="search"
                  value={attendanceEventSearch}
                  onChange={(e) => setAttendanceEventSearch(e.target.value)}
                  placeholder="Title or location"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div className="w-full min-w-40 max-w-xs sm:w-auto">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Event status
                </label>
                <select
                  value={attendanceEventStatusFilter}
                  onChange={(e) =>
                    setAttendanceEventStatusFilter(
                      e.target.value as "all" | "active" | "cancelled",
                    )
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All events</option>
                  <option value="active">Active only</option>
                  <option value="cancelled">Cancelled only</option>
                </select>
              </div>
              <div className="w-full min-w-40 max-w-xs sm:w-auto">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Attendee type
                </label>
                <select
                  value={attendeeTypeFilter}
                  onChange={(e) =>
                    setAttendeeTypeFilter(
                      e.target.value as "all" | "member" | "unassigned",
                    )
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All check-ins</option>
                  <option value="member">Members only</option>
                  <option value="unassigned">No account yet</option>
                </select>
              </div>
              {attendeeTypeFilter !== "member" && (
                <div className="w-full min-w-40 max-w-xs sm:w-auto">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    No-account status
                  </label>
                  <select
                    value={unassignedLinkFilter}
                    onChange={(e) =>
                      setUnassignedLinkFilter(
                        e.target.value as "all" | "pending" | "linked",
                      )
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending signup</option>
                    <option value="linked">Linked to user</option>
                  </select>
                </div>
              )}
              <div className="min-w-48 flex-1 lg:max-w-md">
                <label
                  htmlFor="attendance-person-search"
                  className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Filter people (name or email)
                </label>
                <input
                  id="attendance-person-search"
                  type="search"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  placeholder="Applies to expanded event rows"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
          </div>
          {attendanceLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
              Loading attendance…
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr>
                      <th className="w-10 bg-muted px-2 py-3 sm:px-3" />
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
                            (
                            {sortDir === "asc" ? "oldest first" : "newest first"}
                            )
                          </span>
                        </button>
                      </th>
                      <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                        Check-ins
                      </th>
                      {canManage && (
                        <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                          Add
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {pagedAttendanceEvents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canManage ? 5 : 4}
                          className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                        >
                          No events match the current filters.
                        </td>
                      </tr>
                    ) : (
                      pagedAttendanceEvents.map((row) => {
                        const list = attendanceByEvent.get(row.id) ?? [];
                        const unList = unassignedByEvent.get(row.id) ?? [];
                        const checkInTotal = list.length + unList.length;
                        const expanded = expandedEventIds.has(row.id);
                        const cancelled = row.status === "cancelled";
                        const mergedAll = mergeAttendanceRowsForEvent(list, unList);
                        const mergedFiltered = mergedAll.filter(
                          (r) =>
                            rowMatchesAttendeeType(r, attendeeTypeFilter) &&
                            rowMatchesUnassignedLink(r, unassignedLinkFilter) &&
                            rowMatchesPersonSearch(r, personSearch),
                        );
                        const detailPage = Math.min(
                          Math.max(0, detailPageByEvent[row.id] ?? 0),
                          Math.max(
                            0,
                            Math.ceil(
                              mergedFiltered.length /
                                ATTENDANCE_DETAIL_PAGE_SIZE,
                            ) - 1,
                          ),
                        );
                        const detailFrom = detailPage * ATTENDANCE_DETAIL_PAGE_SIZE;
                        const mergedPage = mergedFiltered.slice(
                          detailFrom,
                          detailFrom + ATTENDANCE_DETAIL_PAGE_SIZE,
                        );
                        const detailPageCount = Math.max(
                          1,
                          Math.ceil(
                            mergedFiltered.length / ATTENDANCE_DETAIL_PAGE_SIZE,
                          ) || 1,
                        );
                        return (
                          <Fragment key={row.id}>
                            <tr
                              className={
                                cancelled
                                  ? "bg-muted/40 opacity-80 hover:bg-muted/50"
                                  : "hover:bg-muted"
                              }
                            >
                              <td className="px-2 py-2 align-middle sm:px-3">
                                <button
                                  type="button"
                                  aria-expanded={expanded}
                                  aria-label={
                                    expanded
                                      ? `Collapse attendance for ${row.title}`
                                      : `Expand attendance for ${row.title}`
                                  }
                                  onClick={() => toggleEventExpanded(row.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                                >
                                  <svg
                                    className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-card-foreground sm:px-6">
                                <span className="font-medium">{row.title}</span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                                {formatWhen(row.start_time)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                                <span title="Members + no-account records">
                                  {checkInTotal}
                                </span>
                                {unList.length > 0 ? (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    ({list.length}+{unList.length})
                                  </span>
                                ) : null}
                              </td>
                              {canManage && (
                                <td className="whitespace-nowrap px-4 py-3 text-right sm:px-6">
                                  <button
                                    type="button"
                                    disabled={cancelled}
                                    onClick={() =>
                                      setAddAttendanceForEvent(row)
                                    }
                                    className="rounded-md border border-border px-2 py-1 text-xs font-medium text-card-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Add attendance
                                  </button>
                                </td>
                              )}
                            </tr>
                            {expanded ? (
                              <tr className="bg-muted/30">
                                <td
                                  colSpan={canManage ? 5 : 4}
                                  className="px-4 py-3 sm:px-6"
                                >
                                  {mergedAll.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                      No check-ins recorded for this event.
                                    </p>
                                  ) : mergedFiltered.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                      No rows match the attendee filters or
                                      name/email search.
                                    </p>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                        <span>
                                          Members:{" "}
                                          <span className="font-medium text-card-foreground">
                                            {list.length}
                                          </span>{" "}
                                          · No account:{" "}
                                          <span className="font-medium text-card-foreground">
                                            {unList.length}
                                          </span>
                                        </span>
                                        <span>
                                          Showing{" "}
                                          <span className="font-medium text-card-foreground">
                                            {mergedFiltered.length}
                                          </span>{" "}
                                          after filters
                                        </span>
                                      </div>
                                      <div className="overflow-x-auto rounded-lg border border-border bg-card">
                                        <table className="min-w-full text-sm">
                                          <thead>
                                            <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                              <th className="px-3 py-2">
                                                Source
                                              </th>
                                              <th className="px-3 py-2">
                                                First name
                                              </th>
                                              <th className="px-3 py-2">
                                                Last name
                                              </th>
                                              <th className="px-3 py-2">
                                                Email / handles
                                              </th>
                                              <th className="px-3 py-2">
                                                Account
                                              </th>
                                              <th className="px-3 py-2">
                                                Checked in
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border">
                                            {mergedPage.map((a) => {
                                              const isUn =
                                                a.kind === "unassigned";
                                              const rowClass = isUn
                                                ? "bg-amber-50 dark:bg-amber-950/25"
                                                : "";
                                              return (
                                                <tr
                                                  key={`${a.kind}-${a.id}`}
                                                  className={rowClass}
                                                >
                                                  <td className="px-3 py-2 text-card-foreground">
                                                    {isUn
                                                      ? "No account"
                                                      : "Member"}
                                                  </td>
                                                  <td className="px-3 py-2 text-card-foreground">
                                                    {a.first_name?.trim() || "—"}
                                                  </td>
                                                  <td className="px-3 py-2 text-card-foreground">
                                                    {a.last_name?.trim() || "—"}
                                                  </td>
                                                  <td className="max-w-56 px-3 py-2 text-xs text-muted-foreground">
                                                    {a.kind === "registered" ? (
                                                      <span className="text-card-foreground">
                                                        {a.email?.trim() || "—"}
                                                      </span>
                                                    ) : (
                                                      <div className="space-y-0.5">
                                                        {a.discord?.trim() ? (
                                                          <div>
                                                            Discord:{" "}
                                                            {a.discord}
                                                          </div>
                                                        ) : null}
                                                        {a.personal_email?.trim() ? (
                                                          <div className="break-all">
                                                            Personal:{" "}
                                                            {a.personal_email}
                                                          </div>
                                                        ) : null}
                                                        {a.cougarnet_email?.trim() ? (
                                                          <div className="break-all">
                                                            Cougarnet:{" "}
                                                            {a.cougarnet_email}
                                                          </div>
                                                        ) : null}
                                                        {!a.discord?.trim() &&
                                                        !a.personal_email?.trim() &&
                                                        !a.cougarnet_email?.trim()
                                                          ? "—"
                                                          : null}
                                                      </div>
                                                    )}
                                                  </td>
                                                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                                                    {a.kind === "registered"
                                                      ? "—"
                                                      : a.is_user
                                                        ? "Linked"
                                                        : "Pending"}
                                                  </td>
                                                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                                                    {formatAttendedAt(
                                                      a.attended_at,
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      {mergedFiltered.length >
                                        ATTENDANCE_DETAIL_PAGE_SIZE && (
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                          <span>
                                            People {detailFrom + 1}–
                                            {Math.min(
                                              detailFrom +
                                                ATTENDANCE_DETAIL_PAGE_SIZE,
                                              mergedFiltered.length,
                                            )}{" "}
                                            of {mergedFiltered.length}
                                          </span>
                                          <div className="flex gap-2">
                                            <button
                                              type="button"
                                              disabled={detailPage <= 0}
                                              onClick={() =>
                                                setDetailPageByEvent((prev) => ({
                                                  ...prev,
                                                  [row.id]: Math.max(
                                                    0,
                                                    (prev[row.id] ?? 0) - 1,
                                                  ),
                                                }))
                                              }
                                              className="rounded-md border border-border px-2 py-1 font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
                                            >
                                              Prev people
                                            </button>
                                            <button
                                              type="button"
                                              disabled={
                                                detailPage >= detailPageCount - 1
                                              }
                                              onClick={() =>
                                                setDetailPageByEvent((prev) => ({
                                                  ...prev,
                                                  [row.id]: Math.min(
                                                    detailPageCount - 1,
                                                    (prev[row.id] ?? 0) + 1,
                                                  ),
                                                }))
                                              }
                                              className="rounded-md border border-border px-2 py-1 font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
                                            >
                                              Next people
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {attendanceFilteredEvents.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-6">
                  {(() => {
                    const pageIdx = Math.min(
                      Math.max(0, attendancePage),
                      attendancePageCount - 1,
                    );
                    const from = pageIdx * PAGE_SIZE + 1;
                    const to = Math.min(
                      (pageIdx + 1) * PAGE_SIZE,
                      attendanceFilteredEvents.length,
                    );
                    return (
                      <p className="text-sm text-muted-foreground">
                        Showing {from}–{to} of {attendanceFilteredEvents.length}
                      </p>
                    );
                  })()}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAttendancePage((p) => Math.max(0, p - 1))
                      }
                      disabled={attendancePage <= 0}
                      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAttendancePage((p) =>
                          Math.min(attendancePageCount - 1, p + 1),
                        )
                      }
                      disabled={attendancePage >= attendancePageCount - 1}
                      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

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
      {addAttendanceForEvent && (
        <AddEventAttendanceModal
          event={addAttendanceForEvent}
          onClose={() => setAddAttendanceForEvent(null)}
          onRecorded={reloadAttendance}
        />
      )}
    </div>
  );
}
