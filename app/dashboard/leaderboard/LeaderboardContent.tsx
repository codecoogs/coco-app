"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LeaderboardRow } from "./queries";
import {
  fetchLeaderboardWithMembers,
  LEADERBOARD_PAGE_SIZE,
} from "./queries";
import Image from "next/image";
import Link from "next/link";

type Props = {
  initialRows: LeaderboardRow[];
  currentUserId: string | null;
  page: number;
  totalCount: number | null;
  pageSize?: number;
};

function displayName(row: LeaderboardRow): string {
  const u = row.users;
  const first = u?.first_name?.trim() ?? "";
  const last = u?.last_name?.trim() ?? "";
  const full = [first, last].filter(Boolean).join(" ");
  if (full) return full;

  const email = u?.email?.trim() ?? "";
  if (email) {
    const at = email.indexOf("@");
    if (at > 0) return email.slice(0, at);
    return email;
  }

  const discord = u?.discord?.trim() ?? "";
  if (discord) return discord;

  return "Member";
}

/** DB column when migrated; falls back to count on this page for same score. */
function tieGroupSizeForRow(row: LeaderboardRow, countsByPoints: Map<number, number>) {
  const db = row.points_tie_group_size;
  if (typeof db === "number" && db >= 1) return db;
  return countsByPoints.get(row.total_points ?? 0) ?? 1;
}

export function LeaderboardContent({
  initialRows,
  currentUserId,
  page,
  totalCount: initialTotal,
  pageSize = LEADERBOARD_PAGE_SIZE,
}: Props) {
  const [rows, setRows] = useState(initialRows);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages =
    totalCount != null && totalCount > 0
      ? Math.max(1, Math.ceil(totalCount / pageSize))
      : 1;

  const showingFrom =
    rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const count = totalCount ?? 0;
  const showingTo =
    count === 0 ? 0 : Math.min(page * pageSize, count);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, totalCount: nextTotal, error: err } =
      await fetchLeaderboardWithMembers(supabase, { page, pageSize });
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setRows(data);
    setTotalCount(nextTotal);
  }, [page, pageSize]);

  const tieCountsForPage = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of rows) {
      const p = r.total_points ?? 0;
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">Rankings</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Sorted by total points.
            {totalCount != null ? (
              <>
                {" "}
                Showing{" "}
                <span className="font-medium text-card-foreground">
                  {showingFrom}–{showingTo}
                </span>{" "}
                of{" "}
                <span className="font-medium text-card-foreground">
                  {totalCount}
                </span>{" "}
                member
                {totalCount !== 1 ? "s" : ""}.
              </>
            ) : (
              <>
                {" "}
                {rows.length} member{rows.length !== 1 ? "s" : ""} on this page.
              </>
            )}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Rank
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Name
                </th>
                <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No leaderboard data yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const rank =
                    row.current_rank != null
                      ? row.current_rank
                      : (page - 1) * pageSize + index + 1;
                  const isYou = currentUserId != null && row.user_id === currentUserId;
                  const avatarUrl = row.users?.avatar_url?.trim() || null;
                  const tieSize = tieGroupSizeForRow(row, tieCountsForPage);
                  const isTied = tieSize > 1;
                  return (
                    <tr
                      key={row.user_id}
                      className={
                        isYou ? "bg-blue-500/5 hover:bg-blue-500/10" : "hover:bg-muted"
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium tabular-nums text-card-foreground sm:px-6">
                        <span>{rank}</span>
                        {isTied ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (tied)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-card-foreground sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                            {avatarUrl ? (
                              <Image
                                src={avatarUrl}
                                alt=""
                                width={32}
                                height={32}
                                unoptimized
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div
                                className="flex h-full w-full items-center justify-center text-[10px] font-medium text-muted-foreground"
                                aria-hidden
                              >
                                {displayName(row).slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium">{displayName(row)}</span>
                        {isYou && (
                          <span className="ml-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                            You
                          </span>
                        )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-card-foreground sm:px-6">
                        {row.total_points ?? 0}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {(totalCount ?? 0) > pageSize && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <nav
              className="flex flex-wrap items-center gap-2"
              aria-label="Leaderboard pagination"
            >
              <Link
                href={
                  page - 1 <= 1
                    ? "/dashboard/leaderboard"
                    : `/dashboard/leaderboard?page=${page - 1}`
                }
                scroll
                prefetch
                aria-disabled={page <= 1}
                className={
                  page <= 1
                    ? "pointer-events-none rounded-lg border border-border px-3 py-2 text-sm font-medium opacity-40"
                    : "rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
                }
              >
                Previous
              </Link>
              <Link
                href={`/dashboard/leaderboard?page=${page + 1}`}
                scroll
                prefetch
                aria-disabled={page >= totalPages}
                className={
                  page >= totalPages
                    ? "pointer-events-none rounded-lg border border-border px-3 py-2 text-sm font-medium opacity-40"
                    : "rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
                }
              >
                Next
              </Link>
            </nav>
          </div>
        )}
      </section>
    </div>
  );
}
