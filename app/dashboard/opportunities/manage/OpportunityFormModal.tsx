"use client";

import {
  EMPLOYMENT_TYPES,
  JOB_SHAPED_CATEGORIES,
  OPPORTUNITY_CATEGORIES,
  type EmploymentType,
  type LinkableForm,
  type Opportunity,
  type OpportunityCategory,
} from "@/lib/types/opportunities";
import { useEffect, useState } from "react";
import {
  createOpportunity,
  getFormsForOpportunityLinking,
  updateOpportunity,
} from "../actions";

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
  const [linkMode, setLinkMode] = useState<"external" | "form">(
    opportunity?.linked_form_id ? "form" : "external"
  );
  const [forms, setForms] = useState<LinkableForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState(
    opportunity?.linked_form_id ?? ""
  );

  useEffect(() => {
    let mounted = true;
    getFormsForOpportunityLinking().then(({ data }) => {
      if (mounted) setForms(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const showJobFields = category
    ? JOB_SHAPED_CATEGORIES.includes(category)
    : false;

  const selectedForm = forms.find((f) => f.id === selectedFormId) ?? null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;

    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
    // link_url and linked_form_id are mutually exclusive — only the field for
    // the active linkMode is rendered/read; the other is sent as null.
    const link_url =
      linkMode === "external"
        ? (form.elements.namedItem("link_url") as HTMLInputElement).value.trim()
        : "";
    const linked_form_id = linkMode === "form" ? selectedFormId : "";
    const description = (
      form.elements.namedItem("description") as HTMLTextAreaElement
    ).value.trim();
    // company_name/location/salary/employment_type only render in the DOM
    // when showJobFields is true — reading them unconditionally throws
    // (namedItem returns null for a non-existent field) when a non-job
    // category (or no category) is selected.
    const company_name = showJobFields
      ? (form.elements.namedItem("company_name") as HTMLInputElement).value.trim()
      : "";
    const location = showJobFields
      ? (form.elements.namedItem("location") as HTMLInputElement).value.trim()
      : "";
    const salary = showJobFields
      ? (form.elements.namedItem("salary") as HTMLInputElement).value.trim()
      : "";
    const employment_type = showJobFields
      ? ((form.elements.namedItem("employment_type") as HTMLSelectElement)
          .value as EmploymentType | "")
      : "";
    const expires_at_raw = (form.elements.namedItem("expires_at") as HTMLInputElement)
      .value;
    const notify_members = (
      form.elements.namedItem("notify_members") as HTMLInputElement
    ).checked;

    if (!title) {
      setMessage({ type: "error", text: "Title is required." });
      return;
    }
    if (linkMode === "external" && !link_url) {
      setMessage({ type: "error", text: "Link is required." });
      return;
    }
    if (linkMode === "form" && !linked_form_id) {
      setMessage({ type: "error", text: "Select a form." });
      return;
    }

    const payload = {
      title,
      link_url: link_url || null,
      linked_form_id: linked_form_id || null,
      description: description || null,
      category: category || null,
      company_name: company_name || null,
      location: location || null,
      employment_type: (employment_type || null) as EmploymentType | null,
      salary: salary || null,
      expires_at: expires_at_raw ? new Date(expires_at_raw).toISOString() : null,
      notify_members,
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
            <div className="mb-2 flex gap-1 rounded-lg border border-border bg-background p-1 text-sm">
              <button
                type="button"
                onClick={() => setLinkMode("external")}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                  linkMode === "external"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                External link
              </button>
              <button
                type="button"
                onClick={() => setLinkMode("form")}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                  linkMode === "form"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Internal form
              </button>
            </div>

            {linkMode === "external" ? (
              <input
                name="link_url"
                type="url"
                required
                placeholder="https://…"
                defaultValue={opportunity?.link_url ?? ""}
                className={inputClass}
              />
            ) : (
              <>
                <select
                  name="linked_form_id"
                  value={selectedFormId}
                  onChange={(e) => setSelectedFormId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a form…</option>
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                      {f.status !== "published" ? ` (${f.status})` : ""}
                    </option>
                  ))}
                </select>
                {selectedForm && selectedForm.status !== "published" ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    This form isn&apos;t published yet — members won&apos;t be
                    able to apply until you publish it.
                  </p>
                ) : null}
              </>
            )}
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

          <div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="notify_members"
                defaultChecked={opportunity?.notify_members ?? true}
              />
              Notify members when this is visible
            </label>
            {opportunity?.source === "csv_import" && !opportunity?.notify_members ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Imported opportunities default to off so a bulk activation
                doesn&apos;t notify everyone at once.
              </p>
            ) : null}
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
