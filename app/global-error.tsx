"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown inside the root layout itself
 * (app/layout.tsx) - app/error.tsx can't catch those since it renders
 * inside the same layout it would need to replace. Has to render its own
 * <html>/<body> since it fully replaces the root layout when active.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uncaught root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            padding: "4rem 1rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ maxWidth: 28 + "rem", color: "#71717a" }}>
            The app hit an error it couldn&apos;t recover from. Try again, or
            reload the page.
          </p>
          <div
            style={{
              width: "100%",
              maxWidth: "32rem",
              textAlign: "left",
              borderRadius: "0.5rem",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              background: "rgba(239, 68, 68, 0.1)",
              padding: "0.75rem 1rem",
            }}
          >
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                wordBreak: "break-word",
                color: "#ef4444",
                margin: 0,
              }}
            >
              {error.message || "Unknown error"}
            </p>
            {error.digest ? (
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.6875rem",
                  color: "#71717a",
                  margin: "0.25rem 0 0",
                }}
              >
                Digest: {error.digest}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              borderRadius: "0.5rem",
              background: "#2563eb",
              color: "white",
              fontWeight: 500,
              padding: "0.75rem 1.5rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
