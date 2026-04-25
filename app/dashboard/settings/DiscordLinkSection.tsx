"use client";

import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { useProfile } from "@/app/contexts/ProfileContext";
import { useCallback, useMemo, useState } from "react";

export function DiscordLinkSection() {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useProfile();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );

  const isLinked = Boolean(
    user?.identities?.some((i) => (i.provider ?? "").toLowerCase() === "discord"),
  );

  const link = useCallback(async () => {
    if (!user?.id) return;
    setMessage(null);
    setBusy(true);

    // Supabase will redirect the browser to Discord; after consent it returns to /auth/callback.
    const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(
      "/dashboard/settings",
    )}`;

    const { error } = await supabase.auth.linkIdentity({
      provider: "discord",
      options: { redirectTo },
    });

    // If successful, the browser navigates away; this is only for immediate failures.
    setBusy(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
    }
  }, [supabase, user?.id]);

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-card-foreground">Discord</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Link your Discord account so we can reliably associate your membership with your
        Discord identity.
      </p>

      {message && (
        <p
          className={
            message.type === "ok"
              ? "mt-3 text-sm text-green-700 dark:text-green-300"
              : "mt-3 text-sm text-red-600 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Status:{" "}
          <span className="font-medium text-card-foreground">
            {isLinked ? "Linked" : "Not linked"}
          </span>
        </div>
        <button
          type="button"
          onClick={link}
          disabled={busy || isLinked}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLinked ? "Discord linked" : busy ? "Redirecting…" : "Link Discord"}
        </button>
      </div>
    </section>
  );
}

