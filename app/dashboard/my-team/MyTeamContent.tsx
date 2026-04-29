"use client";

import { useState, useTransition } from "react";
import { updateMyTeam, type MyTeamView } from "./actions";

export function MyTeamContent({ initial }: { initial: MyTeamView }) {
  const [tab, setTab] = useState<"overview" | "manage">("overview");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const team = initial.team;

  function onSubmit(formData: FormData) {
    if (!team) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      formData.set("team_id", team.id);
      const res = await updateMyTeam(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess("Team details updated.");
    });
  }

  return (
    <div className="space-y-6">
      <div
        className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
        role="tablist"
        aria-label="My team sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "overview"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "manage"}
          onClick={() => setTab("manage")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "manage"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Manage
        </button>
      </div>

      {initial.loadError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {initial.loadError}
        </section>
      ) : !team ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-muted-foreground">
            You are not assigned to a team yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once you are assigned as a member or lead, your team details show up here.
          </p>
        </section>
      ) : tab === "overview" ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-card-foreground">
            {team.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {team.team_number > 0 ? `Team #${team.team_number}` : "Team number not set"}
          </p>
          {team.team_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.team_image_url}
              alt=""
              className="mt-4 h-52 w-full max-w-xl rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="mt-4 flex h-52 w-full max-w-xl items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-4 text-center text-sm text-muted-foreground">
              No team photo uploaded yet.
            </div>
          )}
          <p className="mt-4 text-card-foreground">
            {team.description?.trim() || "No description provided yet."}
          </p>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Members ({initial.members.length})
            </p>
            {initial.members.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No members assigned.
              </p>
            ) : (
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {initial.members.map((m) => (
                  <li key={m.id} className="text-sm text-card-foreground">
                    {m.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : initial.canManage ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">
            Manage my team
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Team leads and users with manage teams permission can edit these fields.
          </p>
          <form action={onSubmit} className="mt-5 space-y-4">
            <input type="hidden" name="team_id" value={team.id} />
            <div>
              <label className="mb-1 block text-sm font-medium text-card-foreground">Team name</label>
              <input
                name="name"
                defaultValue={team.name}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-card-foreground">
                Description
              </label>
              <textarea
                name="description"
                defaultValue={team.description ?? ""}
                rows={4}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-card-foreground">
                Team image
              </label>
              <input
                name="team_image_file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, or WebP. Max 6MB.
              </p>
              {team.team_image_url ? (
                <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    name="remove_team_image"
                    type="checkbox"
                    value="true"
                    className="rounded border-border"
                  />
                  Remove current team image
                </label>
              ) : null}
            </div>
            {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600 dark:text-emerald-300">{success}</p> : null}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save changes"}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-muted-foreground">
            You can view your team details, but only team leads (or users with manage teams)
            can edit this section.
          </p>
        </section>
      )}
    </div>
  );
}
