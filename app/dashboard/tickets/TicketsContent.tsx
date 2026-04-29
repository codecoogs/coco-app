"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TicketRow, CreateTicketInput } from "./actions";

function statusTone(status: string): {
  pill: string;
  label: string;
} {
  const s = status.trim().toLowerCase();
  if (s === "in_progress" || s === "in progress") {
    return { pill: "bg-orange-50 text-orange-800 border-orange-200", label: "In progress" };
  }
  if (s === "completed" || s === "complete") {
    return { pill: "bg-emerald-50 text-emerald-800 border-emerald-200", label: "Completed" };
  }
  if (s === "cancelled" || s === "canceled") {
    return { pill: "bg-red-50 text-red-800 border-red-200", label: "Cancelled" };
  }
  return { pill: "bg-muted/40 text-foreground border-border", label: status };
}

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium" });
  } catch {
    return "—";
  }
}

type Props = {
  initialTickets: TicketRow[];
  canManageTickets: boolean;
  loadError: string | null;
  onCreateTicket: (input: CreateTicketInput) => Promise<{ error: string | null }>;
};

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "points", label: "Points / Point info" },
  { value: "password_reset", label: "Password reset" },
  { value: "feedback", label: "Feedback" },
  { value: "account_linking", label: "Linking account" },
  { value: "other", label: "Other" },
] as const;

export function TicketsContent({
  initialTickets,
  canManageTickets,
  loadError,
  onCreateTicket,
}: Props) {
  const router = useRouter();

  const [tickets, setTickets] = useState(initialTickets);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [categoryChoice, setCategoryChoice] = useState<(typeof CATEGORY_OPTIONS)[number]["value"]>("general");
  const [categoryOther, setCategoryOther] = useState("");

  const effectiveCategory = useMemo(() => {
    if (categoryChoice !== "other") return categoryChoice;
    return categoryOther.trim() || "other";
  }, [categoryChoice, categoryOther]);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (busy) return;
      setBusy(true);
      setMessage(null);

      const res = await onCreateTicket({
        title,
        description,
        category: effectiveCategory,
        priority,
      });

      setBusy(false);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }

      setMessage({ type: "ok", text: "Ticket submitted. You can track it below." });
      setTitle("");
      setDescription("");
      setPriority("normal");
      setCategoryChoice("general");
      setCategoryOther("");

      // Server action revalidates; refresh the list.
      router.refresh();
    },
    [busy, effectiveCategory, onCreateTicket, priority, router, title, description]
  );

  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
        <p className="mt-1 text-muted-foreground">
          Submit software issues and track their status.
        </p>
        {canManageTickets ? (
          <div className="mt-3">
            <Link
              href="/dashboard/ticket-management"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Go to ticket management
            </Link>
          </div>
        ) : null}
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-card-foreground">Submit a ticket</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The team will update the ticket status as it progresses.
        </p>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. My points don’t look correct"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              required
              maxLength={120}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Category
              </label>
              <select
                value={categoryChoice}
                onChange={(e) => setCategoryChoice(e.target.value as typeof categoryChoice)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {categoryChoice === "other" ? (
                <input
                  value={categoryOther}
                  onChange={(e) => setCategoryOther(e.target.value)}
                  placeholder="Describe the category"
                  className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                  maxLength={60}
                />
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              placeholder="Include any relevant details (what you expected, what happened, screenshots if applicable)."
              required
              maxLength={5000}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Submitting..." : "Submit ticket"}
          </button>

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
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-card-foreground">Your tickets</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Track updates to your submitted requests.
        </p>

        {tickets.length === 0 ? (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            No tickets yet. Submit one above.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Title
                  </th>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Category
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
                  return (
                    <tr key={t.id} className="hover:bg-muted">
                      <td className="px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                        {t.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {t.category}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tone.pill}`}
                        >
                          {tone.label}
                        </span>
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

