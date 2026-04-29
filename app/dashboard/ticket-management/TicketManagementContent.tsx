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

  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>(KNOWN_STATUSES as unknown as string[]);
    for (const t of tickets) set.add(t.status);
    return Array.from(set).sort();
  }, [tickets]);

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
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Tickets</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} shown.
            </p>
          </div>
        </div>

        {tickets.length === 0 ? (
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
                {tickets.map((t) => {
                  const tone = statusTone(t.status);
                  const isBusy = updatingId === t.id;
                  return (
                    <tr key={t.id} className="hover:bg-muted">
                      <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                        {t.submitter_name}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-card-foreground">
                        {t.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {t.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {t.priority}
                      </td>
                      <td className="px-4 py-3 text-sm">
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
    </div>
  );
}

