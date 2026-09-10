"use client";

import { Button } from "@/app/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/shadcn/dialog";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAccountVerified, type AuthAccountRow } from "./actions";

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

type Props = {
  accounts: AuthAccountRow[];
  initialError: string | null;
};

export function AccountsTab({ accounts, initialError }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<AuthAccountRow | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (unverifiedOnly && account.verified) return false;
      if (!needle) return true;
      return (
        (account.email ?? "").toLowerCase().includes(needle) ||
        (account.memberName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [accounts, search, unverifiedOnly]);

  const unverifiedCount = useMemo(
    () => accounts.filter((account) => !account.verified).length,
    [accounts]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageAccounts = filtered.slice(start, start + PAGE_SIZE);

  const handleVerify = (account: AuthAccountRow) => {
    setError(null);
    startTransition(async () => {
      const result = await markAccountVerified(account.authId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label
              htmlFor="account-search"
              className="block text-sm font-medium text-card-foreground"
            >
              Search
            </label>
            <input
              id="account-search"
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
              checked={unverifiedOnly}
              onChange={(e) => {
                setUnverifiedOnly(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-border"
            />
            Unverified only
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">
            Sign-in accounts
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtered.length} of {accounts.length} account
            {accounts.length !== 1 ? "s" : ""}
            {unverifiedCount > 0 && ` · ${unverifiedCount} unverified`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                {["Name", "Email", "Status", "Created", "Last sign-in", ""].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {pageAccounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No accounts match the current filters.
                  </td>
                </tr>
              ) : (
                pageAccounts.map((account) => (
                  <tr key={account.authId} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                      {account.memberName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {account.email ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6">
                      <span
                        className={
                          account.verified
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }
                      >
                        {account.verified ? "Verified" : "Unverified"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDate(account.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDate(account.lastSignInAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm sm:px-6">
                      {!account.verified && (
                        <Button
                          size="sm"
                          onClick={() => setConfirming(account)}
                          disabled={pending}
                        >
                          Mark verified
                        </Button>
                      )}
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

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark this email verified?</DialogTitle>
            <DialogDescription>
              This marks {confirming?.email ?? "this account"} as verified
              without the member entering a code, so it skips the check that
              they actually own the address. Only do this when you have
              confirmed who they are some other way — normally they should use
              &ldquo;Forgot password?&rdquo; to verify themselves.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => confirming && handleVerify(confirming)}
              loading={pending}
            >
              {pending ? "Verifying…" : "Mark verified"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
