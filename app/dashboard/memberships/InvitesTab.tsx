"use client";

import { Button } from "@/app/components/ui/Button";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendAttendanceInvite, type InvitableContact } from "./actions";

const PAGE_SIZE = 20;

function formatDate(iso: string | null) {
  if (!iso || iso.trim() === "") return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function fullName(contact: InvitableContact): string {
  return (
    [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "—"
  );
}

type Props = {
  contacts: InvitableContact[];
  initialError: string | null;
};

export function InvitesTab({ contacts, initialError }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [notInvitedOnly, setNotInvitedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (notInvitedOnly && contact.lastInvitedAt) return false;
      if (!needle) return true;
      return (
        contact.email.includes(needle) ||
        fullName(contact).toLowerCase().includes(needle)
      );
    });
  }, [contacts, search, notInvitedOnly]);

  const notInvitedCount = useMemo(
    () => contacts.filter((contact) => !contact.lastInvitedAt).length,
    [contacts]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageContacts = filtered.slice(start, start + PAGE_SIZE);

  const handleInvite = (contact: InvitableContact) => {
    setError(null);
    setNotice(null);
    setSendingTo(contact.email);
    startTransition(async () => {
      const result = await sendAttendanceInvite(contact.email);
      setSendingTo(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(`Invite sent to ${contact.email}.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <p className="text-sm text-muted-foreground">
          People who signed in at an event but have no account yet. One row per
          email address, however many events they came to. Anyone who has since
          signed up drops off this list automatically.
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label
              htmlFor="contact-search"
              className="block text-sm font-medium text-card-foreground"
            >
              Search
            </label>
            <input
              id="contact-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Email or name"
              className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-card-foreground">
            <input
              type="checkbox"
              checked={notInvitedOnly}
              onChange={(e) => {
                setNotInvitedOnly(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-border"
            />
            Not yet invited
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {notice}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">
            Event contacts without an account
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtered.length} of {contacts.length} contact
            {contacts.length !== 1 ? "s" : ""}
            {notInvitedCount > 0 && ` · ${notInvitedCount} not yet invited`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                {["Name", "Email", "Last attended", "Last invited", ""].map(
                  (heading, i) => (
                    <th
                      key={heading || `actions-${i}`}
                      className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {pageContacts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No contacts match the current filters.
                  </td>
                </tr>
              ) : (
                pageContacts.map((contact) => (
                  <tr key={contact.email} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                      {fullName(contact)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {contact.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDate(contact.lastAttendedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDate(contact.lastInvitedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm sm:px-6">
                      <Button
                        size="sm"
                        onClick={() => handleInvite(contact)}
                        loading={pending && sendingTo === contact.email}
                        disabled={pending}
                      >
                        {contact.lastInvitedAt ? "Send again" : "Send invite"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
