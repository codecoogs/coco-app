"use client";

import type { Resource } from "@/lib/types/resources";
import { useState } from "react";
import { createResource, updateResource } from "./actions";

type Props = {
  mode: "create" | "edit";
  resource?: Resource;
  /** Existing category values, offered as suggestions so the public site's tabs don't fragment on typos. */
  categories: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground";

export function ResourceFormModal({
  mode,
  resource,
  categories,
  onClose,
  onSaved,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;

    const value = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value.trim();

    const payload = {
      title: value("title"),
      category: value("category"),
      link_url: value("link_url"),
      description: value("description") || null,
      extension: value("extension") || null,
      resource_date: value("resource_date") || null,
      website_viewable: (form.elements.namedItem("website_viewable") as HTMLInputElement)
        .checked,
    };

    setBusy(true);
    const result =
      mode === "create"
        ? await createResource(payload)
        : resource
          ? await updateResource(resource.id, payload)
          : { error: "Missing resource." };
    setBusy(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    await onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-modal-title"
      onClick={onClose}
      onKeyDown={(ev) => {
        if (ev.key === "Escape") onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="resource-modal-title"
          className="text-lg font-semibold text-card-foreground"
        >
          {mode === "create" ? "New resource" : "Edit resource"}
        </h2>

        {message && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Title
            </label>
            <input
              name="title"
              required
              defaultValue={resource?.title ?? ""}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Category
            </label>
            <input
              name="category"
              required
              list="resource-categories"
              placeholder="e.g. Workshops"
              defaultValue={resource?.category ?? ""}
              className={inputClass}
            />
            <datalist id="resource-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-muted-foreground">
              The website groups resources into tabs by category, so a new value
              creates a new tab.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Link
            </label>
            <input
              name="link_url"
              type="url"
              required
              placeholder="https://…"
              defaultValue={resource?.link_url ?? ""}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Description (optional)
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={resource?.description ?? ""}
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                File type (optional)
              </label>
              <input
                name="extension"
                placeholder="e.g. pdf"
                defaultValue={resource?.extension ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Date (optional)
              </label>
              <input
                name="resource_date"
                type="date"
                defaultValue={resource?.resource_date ?? ""}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="website_viewable"
                defaultChecked={resource?.website_viewable ?? false}
              />
              Show on codecoogs.com
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
