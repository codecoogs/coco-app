"use client";

import {
  EMPLOYMENT_TYPES,
  OPPORTUNITY_CATEGORIES,
  type EmploymentType,
  type Opportunity,
  type OpportunityCategory,
} from "@/lib/types/opportunities";
import { useState } from "react";
import { createOpportunity, updateOpportunity } from "../actions";

type Props = {
  mode: "create" | "edit";
  opportunity?: Opportunity;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground";

export function OpportunityFormModal({ mode, opportunity, onClose, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(
    null
  );
  const [category, setCategory] = useState<OpportunityCategory | "">(
    opportunity?.category ?? ""
  );

  const showJobFields = category === "Internship" || category === "Other";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;

    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
    const link_url = (
      form.elements.namedItem("link_url") as HTMLInputElement
    ).value.trim();
    const description = (
      form.elements.namedItem("description") as HTMLTextAreaElement
    ).value.trim();
    const company_name = (
      form.elements.namedItem("company_name") as HTMLInputElement
    ).value.trim();
    const location = (form.elements.namedItem("location") as HTMLInputElement).value.trim();
    const salary = (form.elements.namedItem("salary") as HTMLInputElement).value.trim();
    const employment_type = (
      form.elements.namedItem("employment_type") as HTMLSelectElement
    ).value as EmploymentType | "";
    const expires_at_raw = (form.elements.namedItem("expires_at") as HTMLInputElement)
      .value;

    if (!title) {
      setMessage({ type: "error", text: "Title is required." });
      return;
    }
    if (!link_url) {
      setMessage({ type: "error", text: "Link is required." });
      return;
    }

    const payload = {
      title,
      link_url,
      description: description || null,
      category: category || null,
      company_name: company_name || null,
      location: location || null,
      employment_type: (employment_type || null) as EmploymentType | null,
      salary: salary || null,
      expires_at: expires_at_raw ? new Date(expires_at_raw).toISOString() : null,
    };

    setBusy(true);
    const result =
      mode === "create"
        ? await createOpportunity(payload)
        : opportunity
          ? await updateOpportunity(opportunity.id, payload)
          : { error: "Missing opportunity." };
    setBusy(false);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
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
      aria-labelledby="opportunity-modal-title"
      onClick={onClose}
      onKeyDown={(ev) => {
        if (ev.key === "Escape") onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="opportunity-modal-title" className="text-lg font-semibold text-card-foreground">
          {mode === "create" ? "New opportunity" : "Edit opportunity"}
        </h2>

        {message && (
          <div
            className={
              message.type === "error"
                ? "mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                : "mt-3 rounded-lg border border-green-200 bg-green-50 p-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
            }
          >
            {message.text}
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
              defaultValue={opportunity?.title ?? ""}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Category
            </label>
            <select
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as OpportunityCategory | "")}
              className={inputClass}
            >
              <option value="">Select a category…</option>
              {OPPORTUNITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
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
              rows={4}
              defaultValue={opportunity?.description ?? ""}
              className={inputClass}
            />
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
              defaultValue={opportunity?.link_url ?? ""}
              className={inputClass}
            />
          </div>

          {showJobFields && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Company
                  </label>
                  <input
                    name="company_name"
                    defaultValue={opportunity?.company_name ?? ""}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Location
                  </label>
                  <input
                    name="location"
                    defaultValue={opportunity?.location ?? ""}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Employment type
                  </label>
                  <select
                    name="employment_type"
                    defaultValue={opportunity?.employment_type ?? ""}
                    className={inputClass}
                  >
                    <option value="">None</option>
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Salary (optional)
                  </label>
                  <input
                    name="salary"
                    placeholder="e.g. $20-25/hr"
                    defaultValue={opportunity?.salary ?? ""}
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Expires (optional)
            </label>
            <input
              name="expires_at"
              type="date"
              defaultValue={
                opportunity?.expires_at ? opportunity.expires_at.slice(0, 10) : ""
              }
              className={inputClass}
            />
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
