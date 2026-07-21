"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { FormSummary } from "@/lib/types/forms";
import { archiveForm, createForm, getForms, setFormStatus } from "../actions";

type Props = {
  initialForms: FormSummary[];
};

const STATUS_STYLES: Record<FormSummary["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  closed: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
};

export function FormsManagementContent({ initialForms }: Props) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    null
  );

  const refresh = useCallback(async () => {
    const res = await getForms();
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setForms(res.data);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) => f.title.toLowerCase().includes(q));
  }, [forms, search]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const title = newTitle.trim();
      if (!title) return;
      setBusy(true);
      setMessage(null);
      const res = await createForm(title);
      setBusy(false);
      if (res.error || !res.id) {
        setMessage({ type: "error", text: res.error ?? "Could not create form." });
        return;
      }
      router.push(`/dashboard/forms/manage/${res.id}/edit`);
    },
    [newTitle, router]
  );

  const handleStatusChange = useCallback(
    async (formId: string, status: FormSummary["status"]) => {
      setBusy(true);
      const res = await setFormStatus(formId, status);
      setBusy(false);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      await refresh();
    },
    [refresh]
  );

  const handleArchiveToggle = useCallback(
    async (formId: string, isActive: boolean) => {
      setBusy(true);
      const res = await archiveForm(formId, isActive);
      setBusy(false);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      await refresh();
    },
    [refresh]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search forms…"
          className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground sm:w-64"
        />
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New form title…"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={busy || !newTitle.trim()}
            className="shrink-0 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
          >
            New form
          </button>
        </form>
      </div>

      {message && (
        <p
          className={
            message.type === "ok"
              ? "text-sm text-green-700 dark:text-green-300"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      )}

      {!filtered.length ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No forms yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Audience</th>
                <th className="px-4 py-3 font-medium">Responses</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/forms/manage/${f.id}/edit`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {f.title}
                    </Link>
                    {!f.is_active && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[f.status]}`}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">
                    {f.audience_type}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.response_count}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <Link
                        href={`/dashboard/forms/manage/${f.id}/edit`}
                        className="text-foreground hover:underline"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/dashboard/forms/manage/${f.id}/preview`}
                        className="text-foreground hover:underline"
                      >
                        Preview
                      </Link>
                      <Link
                        href={`/dashboard/forms/manage/${f.id}/responses`}
                        className="text-foreground hover:underline"
                      >
                        Responses
                      </Link>
                      {f.status === "draft" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleStatusChange(f.id, "published")}
                          className="text-green-700 hover:underline dark:text-green-400"
                        >
                          Publish
                        </button>
                      )}
                      {f.status === "published" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleStatusChange(f.id, "closed")}
                          className="text-amber-700 hover:underline dark:text-amber-400"
                        >
                          Close
                        </button>
                      )}
                      {f.status === "closed" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleStatusChange(f.id, "published")}
                          className="text-green-700 hover:underline dark:text-green-400"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleArchiveToggle(f.id, !f.is_active)}
                        className="text-red-600 hover:underline dark:text-red-400"
                      >
                        {f.is_active ? "Archive" : "Restore"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
