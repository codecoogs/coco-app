"use client";

import type { UserPaymentInfo } from "@/lib/codecoogs-api";
import { useMemo, useState } from "react";

const PAGE_SIZE = 20;

function formatDate(iso: string) {
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

function isActiveMember(u: UserPaymentInfo): boolean {
  if (u.membership !== "Yearly" && u.membership !== "Semester") return false;
  const due = u.next_due_date?.trim();
  if (!due) return false;
  try {
    return new Date(due) > new Date();
  } catch {
    return false;
  }
}

function fullName(u: UserPaymentInfo): string {
  const first = u.first_name?.trim() ?? "";
  const last = u.last_name?.trim() ?? "";
  return [first, last].filter(Boolean).join(" ") || "—";
}

type SortKey = "first_name" | "last_name";
type SortOrder = "asc" | "desc";

type Props = { users: UserPaymentInfo[] };

export function MembershipsContent({ users }: Props) {
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [paidOnly, setPaidOnly] = useState(false);
  const [membershipFilter, setMembershipFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("first_name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);

  const filteredAndSorted = useMemo(() => {
    let list = [...users];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          fullName(u).toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.major ?? "").toLowerCase().includes(q)
      );
    }
    if (activeOnly) list = list.filter(isActiveMember);
    if (paidOnly) list = list.filter((u) => u.paid === true);
    if (membershipFilter)
      list = list.filter((u) => u.membership === membershipFilter);
    list.sort((a, b) => {
      const aVal =
        sortKey === "first_name"
          ? (a.first_name ?? "").toLowerCase()
          : (a.last_name ?? "").toLowerCase();
      const bVal =
        sortKey === "first_name"
          ? (b.first_name ?? "").toLowerCase()
          : (b.last_name ?? "").toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  }, [
    users,
    search,
    activeOnly,
    paidOnly,
    membershipFilter,
    sortKey,
    sortOrder,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageUsers = filteredAndSorted.slice(start, start + PAGE_SIZE);

  const membershipTypes = useMemo(() => {
    const set = new Set(users.map((u) => u.membership).filter(Boolean));
    return Array.from(set).sort();
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Search by name, email, major…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => {
                setActiveOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-border"
            />
            Active only
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={paidOnly}
              onChange={(e) => {
                setPaidOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-border"
            />
            Paid only
          </label>
          <select
            value={membershipFilter}
            onChange={(e) => {
              setMembershipFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="">All types</option>
            {membershipTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Sort:</span>
            <select
              value={`${sortKey}-${sortOrder}`}
              onChange={(e) => {
                const [k, o] = e.target.value.split("-") as [SortKey, SortOrder];
                setSortKey(k);
                setSortOrder(o);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground"
            >
              <option value="first_name-asc">First name A–Z</option>
              <option value="first_name-desc">First name Z–A</option>
              <option value="last_name-asc">Last name A–Z</option>
              <option value="last_name-desc">Last name Z–A</option>
            </select>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">
            All users (payment info)
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filteredAndSorted.length} of {users.length} member
            {users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Name
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Email
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Major
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Membership
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Paid
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Next due
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Last payment
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {pageUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No members match the current filters.
                  </td>
                </tr>
              ) : (
                pageUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                      {fullName(u)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {u.email || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {u.major || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {u.membership}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6">
                      <span
                        className={
                          u.paid
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }
                      >
                        {u.paid ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDate(u.next_due_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDate(u.last_payment_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredAndSorted.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
              <span className="ml-2">
                ({start + 1}–{Math.min(start + PAGE_SIZE, filteredAndSorted.length)} of{" "}
                {filteredAndSorted.length})
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
