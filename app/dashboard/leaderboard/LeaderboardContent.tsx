"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LeaderboardRow } from "./queries";
import { fetchLeaderboardWithMembers } from "./queries";

type Props = {
  initialRows: LeaderboardRow[];
  currentUserId: string | null;
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

export function LeaderboardContent({ initialRows, currentUserId }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await fetchLeaderboardWithMembers(supabase);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setRows(data);
  }, []);

  const ranked = useMemo(() => {
    return [...rows].sort((a, b) => {
      const pa = a.total_points ?? 0;
      const pb = b.total_points ?? 0;
      if (pb !== pa) return pb - pa;
      return a.user_id.localeCompare(b.user_id);
    });
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
            Sorted by total points. {ranked.length} member
            {ranked.length !== 1 ? "s" : ""}
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
              {ranked.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No leaderboard data yet.
                  </td>
                </tr>
              ) : (
                ranked.map((row, index) => {
                  const rank =
                    row.current_rank != null ? row.current_rank : index + 1;
                  const isYou = currentUserId != null && row.user_id === currentUserId;
                  return (
                    <tr
                      key={row.user_id}
                      className={
                        isYou ? "bg-blue-500/5 hover:bg-blue-500/10" : "hover:bg-muted"
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                        {rank}
                      </td>
                      <td className="px-4 py-3 text-sm text-card-foreground sm:px-6">
                        <span className="font-medium">{displayName(row)}</span>
                        {isYou && (
                          <span className="ml-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                            You
                          </span>
                        )}
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
      </section>
    </div>
  );
}
