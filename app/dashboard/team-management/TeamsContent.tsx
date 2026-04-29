"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  clearTeamImageForManage,
  createTeam,
  deleteTeam,
  getTeamsForManage,
  uploadTeamImageForManage,
  updateTeam,
  type AcademicYearOption,
  type TeamManageRow,
} from "./actions";

type Props = {
  initialTeams: TeamManageRow[];
  academicYears: AcademicYearOption[];
  loadErrorTeams: string | null;
  loadErrorYears: string | null;
  canManage: boolean;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function truncate(s: string | null, max: number) {
  if (!s) return "—";
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function TeamsContent({
  initialTeams,
  academicYears,
  loadErrorTeams,
  loadErrorYears,
  canManage,
}: Props) {
  const router = useRouter();
  const [teams, setTeams] = useState(initialTeams);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TeamManageRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(
    null
  );

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  const reload = useCallback(async () => {
    const res = await getTeamsForManage();
    if (!res.error) setTeams(res.data);
    router.refresh();
  }, [router]);

  const handleCreate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const name = (form.elements.namedItem("name") as HTMLInputElement).value;
      const team_number = Number((form.elements.namedItem("team_number") as HTMLInputElement).value);
      const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
      const ay = (form.elements.namedItem("academic_year") as HTMLSelectElement).value;
      setBusy(true);
      setMessage(null);
      const teamImageFile = form.elements.namedItem("team_image_file") as HTMLInputElement;
      const selectedFile = teamImageFile?.files?.[0] ?? null;

      const { error, id } = await createTeam({
        name,
        team_number: Number.isFinite(team_number) ? team_number : 0,
        description: description.trim() || null,
        academic_year: ay === "" ? null : ay,
      });
      if (!error && id && selectedFile) {
        const fd = new FormData();
        fd.set("team_id", id);
        fd.set("file", selectedFile);
        const up = await uploadTeamImageForManage(fd);
        if (up.error) {
          setBusy(false);
          setMessage({ type: "error", text: `Team created, but image upload failed: ${up.error}` });
          await reload();
          return;
        }
      }
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setMessage({ type: "ok", text: "Team created." });
      setAdding(false);
      form.reset();
      await reload();
    },
    [reload]
  );

  const handleUpdate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editing) return;
      const form = e.currentTarget;
      const name = (form.elements.namedItem("name") as HTMLInputElement).value;
      const team_number = Number((form.elements.namedItem("team_number") as HTMLInputElement).value);
      const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
      const ay = (form.elements.namedItem("academic_year") as HTMLSelectElement).value;
      const removeImage = (form.elements.namedItem("remove_team_image") as HTMLInputElement)?.checked;
      const teamImageFile = form.elements.namedItem("team_image_file") as HTMLInputElement;
      const selectedFile = teamImageFile?.files?.[0] ?? null;
      setBusy(true);
      setMessage(null);
      const { error } = await updateTeam(editing.id, {
        name,
        team_number: Number.isFinite(team_number) ? team_number : 0,
        description: description.trim() || null,
        academic_year: ay === "" ? null : ay,
      });
      setBusy(false);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      if (removeImage) {
        const rm = await clearTeamImageForManage(editing.id);
        if (rm.error) {
          setBusy(false);
          setMessage({ type: "error", text: `Team updated, but image removal failed: ${rm.error}` });
          await reload();
          return;
        }
      } else if (selectedFile) {
        const fd = new FormData();
        fd.set("team_id", editing.id);
        fd.set("file", selectedFile);
        const up = await uploadTeamImageForManage(fd);
        if (up.error) {
          setBusy(false);
          setMessage({ type: "error", text: `Team updated, but image upload failed: ${up.error}` });
          await reload();
          return;
        }
      }
      setMessage({ type: "ok", text: "Team updated." });
      setEditing(null);
      await reload();
    },
    [editing, reload]
  );

  const handleDelete = useCallback(
    async (id: string, teamName: string) => {
      if (!confirm(`Delete team "${teamName}"? This removes its lead row if any.`)) return;
      setBusy(true);
      setMessage(null);
      const { error } = await deleteTeam(id);
      setBusy(false);
      if (error) setMessage({ type: "error", text: error });
      else setMessage({ type: "ok", text: "Team deleted." });
      await reload();
    },
    [reload]
  );

  const loadBanner = loadErrorTeams || loadErrorYears;

  return (
    <div className="space-y-4">
      {loadBanner ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {loadErrorTeams}
          {loadErrorTeams && loadErrorYears ? " " : ""}
          {loadErrorYears}
        </div>
      ) : null}
      {message && (
        <div
          className={
            message.type === "error"
              ? "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
              : "rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
          }
        >
          {message.text}
        </div>
      )}

      {canManage ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditing(null);
              setMessage(null);
            }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            Add team
          </button>
        </div>
      ) : null}

      {canManage && adding ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">New team</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Team number
              </label>
              <input
                name="team_number"
                type="number"
                defaultValue={0}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Academic year
              </label>
              <select
                name="academic_year"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="">None</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.is_current ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea name="description" rows={3} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Team photo
              </label>
              <input
                name="team_image_file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP. Max 6MB.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {canManage && editing ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">Edit team</h2>
          <form key={editing.id} onSubmit={handleUpdate} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                name="name"
                required
                defaultValue={editing.name}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Team number
              </label>
              <input
                name="team_number"
                type="number"
                defaultValue={editing.team_number}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Academic year
              </label>
              <select
                name="academic_year"
                defaultValue={editing.academic_year ?? ""}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="">None</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.is_current ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                defaultValue={editing.description ?? ""}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Team photo
              </label>
              {editing.team_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={editing.team_image_url}
                  alt=""
                  className="mb-2 h-36 w-full max-w-sm rounded-lg border border-border object-cover"
                />
              ) : null}
              <input
                name="team_image_file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP. Max 6MB.</p>
              {editing.team_image_url ? (
                <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    name="remove_team_image"
                    type="checkbox"
                    className="rounded border-border"
                  />
                  Remove current team photo
                </label>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-card-foreground">Teams</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {teams.length} team{teams.length !== 1 ? "s" : ""} — name, number, academic year, and description.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  #
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Name
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Academic year
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Description
                </th>
                <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  Updated
                </th>
                {canManage ? (
                  <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {teams.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 6 : 5}
                    className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                  >
                    No teams yet.
                  </td>
                </tr>
              ) : (
                teams.map((row) => (
                  <tr key={row.id} className="hover:bg-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {row.team_number}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {row.academic_year_label ?? "—"}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {truncate(row.description, 80)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:px-6">
                      {formatDate(row.updated_at ?? row.created_at)}
                    </td>
                    {canManage ? (
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm sm:px-6">
                        <button
                          type="button"
                          onClick={() => {
                            setAdding(false);
                            setMessage(null);
                            setEditing(row);
                          }}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Edit
                        </button>
                        <span className="text-muted-foreground"> · </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id, row.name)}
                          disabled={busy}
                          className="font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
