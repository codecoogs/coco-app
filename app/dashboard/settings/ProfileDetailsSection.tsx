"use client";

import { sanitizeExpectedGraduationInput } from "@/lib/validation";
import { updateMyProfile } from "./actions";
import { useCallback, useState } from "react";

export type ProfileDetailsInitial = {
  first_name: string;
  last_name: string;
  phone: string;
  classification: string;
  expected_graduation: string;
  major: string | null;
  discord: string | null;
};

type Props = {
  initial: ProfileDetailsInitial;
};

export function ProfileDetailsSection({ initial }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );
  const [grad, setGrad] = useState(initial.expected_graduation ?? "");

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setMessage(null);
      setBusy(true);
      const formData = new FormData(e.currentTarget);
      const res = await updateMyProfile(formData);
      setBusy(false);
      if (res.ok) setMessage({ type: "ok", text: "Profile updated." });
      else setMessage({ type: "error", text: res.error });
    },
    [],
  );

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-card-foreground">Profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Keep your membership info up to date.
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

      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            First name
          </label>
          <input
            name="first_name"
            required
            defaultValue={initial.first_name}
            autoComplete="given-name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Last name
          </label>
          <input
            name="last_name"
            required
            defaultValue={initial.last_name}
            autoComplete="family-name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Phone
          </label>
          <input
            name="phone"
            defaultValue={initial.phone}
            autoComplete="tel"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Classification
          </label>
          <input
            name="classification"
            defaultValue={initial.classification}
            placeholder="e.g. Freshman / Sophomore / Junior / Senior"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Expected graduation
          </label>
          <input
            name="expected_graduation"
            required
            inputMode="numeric"
            spellCheck={false}
            value={grad}
            onChange={(e) => setGrad(sanitizeExpectedGraduationInput(e.target.value))}
            placeholder="YYYY-MM"
            title="Year and month: YYYY-MM (months 01–09 use a leading zero)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Format: YYYY-MM, e.g. 2026-05.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Major
          </label>
          <input
            name="major"
            defaultValue={initial.major ?? ""}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Discord
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={initial.discord ?? ""}
              disabled
              className="w-full flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-foreground disabled:opacity-80"
              placeholder="Not linked"
            />
            <span className="text-xs text-muted-foreground">
              Use “Link Discord” below to connect your Discord account.
            </span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

