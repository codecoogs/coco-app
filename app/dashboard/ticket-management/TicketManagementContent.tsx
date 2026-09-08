"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TicketManageRow, UpdateTicketStatusInput } from "./actions";

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium" });
  } catch {
    return "—";
  }
}

function statusTone(status: string): { pill: string; label: string } {
  const s = status.trim().toLowerCase();
  if (s === "in_progress" || s === "in progress") {
    return {
      pill: "bg-orange-50 text-orange-800 border-orange-200",
      label: "In progress",
    };
  }
  if (s === "completed" || s === "complete") {
    return {
      pill: "bg-emerald-50 text-emerald-800 border-emerald-200",
      label: "Completed",
    };
  }
  if (s === "cancelled" || s === "canceled") {
    return {
      pill: "bg-red-50 text-red-800 border-red-200",
      label: "Cancelled",
    };
  }
  return { pill: "bg-muted/40 text-foreground border-border", label: status };
}

type Props = {
  initialTickets: TicketManageRow[];
  canManageTickets: boolean;
  loadError: string | null;
  onUpdateStatus: (input: UpdateTicketStatusInput) => Promise<{ error: string | null }>;
};

const KNOWN_STATUSES = [
  "in_progress",
  "completed",
  "cancelled",
  "waiting_on_user",
  "waiting_on_admin",
] as const;

/** Statuses "Hide completed" filters out - closed either way, nothing left to do. */
function isClosed(status: string): boolean {
  const s = status.trim().toLowerCase();
  return (
    s === "completed" || s === "complete" || s === "cancelled" || s === "canceled"
  );
}

export function TicketManagementContent({
  initialTickets,
  canManageTickets,
  loadError,
  onUpdateStatus,
}: Props) {
  const router = useRouter();
  const [tickets, setTickets] = useState(initialTickets);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  useEffect(() => {
    if (!openTicketId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenTicketId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openTicketId]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>(KNOWN_STATUSES as unknown as string[]);
    for (const t of tickets) set.add(t.status);
    return Array.from(set).sort();
  }, [tickets]);

  const visibleTickets = useMemo(
    () => (hideCompleted ? tickets.filter((t) => !isClosed(t.status)) : tickets),
    [tickets, hideCompleted]
  );

  // Read off `tickets` rather than a snapshot so the modal reflects a status
  // change made from inside it without needing its own copy of the row.
  const openTicket = useMemo(
    () => tickets.find((t) => t.id === openTicketId) ?? null,
    [tickets, openTicketId]
  );

  const update = useCallback(
    async (ticketId: string, status: string) => {
      if (!canManageTickets) return;
      if (updatingId) return;

      setMessage(null);
      setUpdatingId(ticketId);
      const res = await onUpdateStatus({ ticketId, status });
      setUpdatingId(null);

      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      // Apply locally too: the modal renders off `tickets`, and waiting for
      // router.refresh() to round-trip would leave it showing the old status.
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status } : t))
      );
      setMessage({ type: "ok", text: "Status updated." });
      router.refresh();
    },
    [canManageTickets, onUpdateStatus, router, updatingId]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ticket management</h1>
          <p className="mt-1 text-muted-foreground">
            Update ticket status and track submissions.
          </p>
        </div>
        <div>
          <Link
            href="/dashboard/tickets"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to my tickets
          </Link>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {message ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Tickets</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {visibleTickets.length} ticket{visibleTickets.length !== 1 ? "s" : ""}{" "}
              shown.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Hide completed
          </label>
        </div>

        {visibleTickets.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            No tickets found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Submitter
                  </th>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Title
                  </th>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </th>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Category
                  </th>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Priority
                  </th>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {visibleTickets.map((t) => {
                  const tone = statusTone(t.status);
                  const isBusy = updatingId === t.id;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setOpenTicketId(t.id)}
                      className="cursor-pointer hover:bg-muted"
                    >
                      <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                        {t.submitter_name}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-card-foreground">
                        {t.title}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-sm text-muted-foreground">
                        {/* line-clamp truncates on a line boundary rather than a
                            character count, so it never cuts mid-word. */}
                        <span className="line-clamp-2">{t.description || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {t.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {t.priority}
                      </td>
                      <td
                        className="px-4 py-3 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canManageTickets ? (
                          <label className="block">
                            <select
                              value={t.status}
                              disabled={isBusy}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                update(t.id, e.target.value)
                              }
                              className="w-full rounded-md border border-border bg-card px-2 py-1 text-sm"
                            >
                              {statusOptions.map((s) => (
                                <option key={s} value={s}>
                                  {statusTone(s).label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tone.pill}`}
                          >
                            {tone.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatShortDate(t.created_on)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openTicket ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ticket: ${openTicket.title}`}
          // Closing on backdrop click only: the click must have started AND
          // ended on the backdrop itself, which `e.target === e.currentTarget`
          // gives us - otherwise a drag that ends outside the panel closes it.
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenTicketId(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-card-foreground">
                {openTicket.title}
              </h3>
              <button
                type="button"
                onClick={() => setOpenTicketId(null)}
                aria-label="Close"
                className="shrink-0 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">Submitter</dt>
                <dd className="text-card-foreground">{openTicket.submitter_name}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Description</dt>
                <dd className="whitespace-pre-wrap text-card-foreground">
                  {openTicket.description || "—"}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="font-medium text-muted-foreground">Category</dt>
                  <dd className="text-card-foreground">{openTicket.category}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Priority</dt>
                  <dd className="text-card-foreground">{openTicket.priority}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Submitted</dt>
                  <dd className="text-card-foreground">
                    {formatShortDate(openTicket.created_on)}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Last updated</dt>
                  <dd className="text-card-foreground">
                    {formatShortDate(openTicket.updated_on)}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="mb-1 font-medium text-muted-foreground">Status</dt>
                <dd>
                  {canManageTickets ? (
                    <select
                      value={openTicket.status}
                      disabled={updatingId === openTicket.id}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        update(openTicket.id, e.target.value)
                      }
                      className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {statusTone(s).label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                        statusTone(openTicket.status).pill
                      }`}
                    >
                      {statusTone(openTicket.status).label}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}

