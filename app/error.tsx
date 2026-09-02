"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Catches uncaught render errors below the root layout (all dashboard and
 * marketing pages). Without this, Next.js falls back to its generic
 * "Application error: a client-side exception has occurred" page, which
 * shows nothing about what actually broke - console.error below at least
 * gets the real message/stack into the browser console, and the digest
 * (when present) can be grepped out of Vercel's server logs.
 */
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uncaught render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-[20%] left-[10%] h-[20rem] w-[20rem] rounded-full bg-error/5 blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] h-[15rem] w-[15rem] rounded-full bg-warning/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            Something went wrong
          </h1>
          <p className="max-w-md text-base text-muted-foreground">
            The page hit an error it couldn&apos;t recover from. Try again, or
            head back to the dashboard.
          </p>
        </div>

        <div className="w-full space-y-2 rounded-lg border border-error-border bg-error-soft px-4 py-3 text-left">
          <p className="font-mono text-xs break-words text-error">
            {error.message || "Unknown error"}
          </p>
          {error.digest ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              Digest: {error.digest}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-6 py-3 font-medium text-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          >
            Go to Dashboard
          </Link>
        </div>

        <div className="mt-4 inline-block rounded-full bg-error-soft px-4 py-2 text-sm font-medium text-error border border-error-border">
          Error Code: 500
        </div>
      </div>
    </div>
  );
}
