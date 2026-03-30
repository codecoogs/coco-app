"use client";

import { createClient } from "@/lib/supabase/client";
import {
  createEvent,
  updateEvent,
  type EventRow,
  type PointCategoryOption,
} from "./actions";
import { isBefore, parseISO } from "date-fns";
import { useCallback, useMemo, useState } from "react";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pickCategoryId(
  row: EventRow | null,
  categories: PointCategoryOption[],
): string {
  if (!categories.length) return "";
  if (!row?.point_category?.trim()) {
    return categories[0].id;
  }
  const match = categories.find((c) => c.id === row.point_category);
  return match?.id ?? categories[0].id;
}

type Props = {
  mode: "create" | "edit";
  event: EventRow | null;
  categories: PointCategoryOption[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function EventFormModal({
  mode,
  event,
  categories,
  onClose,
  onSaved,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);

  const defaultCategoryId = useMemo(
    () => pickCategoryId(event, categories),
    [event, categories],
  );

  const uploadFlyer = useCallback(
    async (file: File): Promise<string | null> => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `flyers/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage
        .from("assets")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return null;
      }
      const { data } = supabase.storage.from("assets").getPublicUrl(path);
      return data.publicUrl;
    },
    [supabase],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;
    const title = (
      form.elements.namedItem("title") as HTMLInputElement
    ).value.trim();
    const description = (
      form.elements.namedItem("description") as HTMLTextAreaElement
    ).value.trim();
    const location = (
      form.elements.namedItem("location") as HTMLInputElement
    ).value.trim();
    const startRaw = (form.elements.namedItem("start_time") as HTMLInputElement)
      .value;
    const endRaw = (form.elements.namedItem("end_time") as HTMLInputElement)
      .value;
    const categoryId = (
      form.elements.namedItem("category_id") as HTMLSelectElement
    ).value;
    const is_public = (form.elements.namedItem("is_public") as HTMLInputElement)
      .checked;
    const flyerInput = form.elements.namedItem("flyer") as HTMLInputElement;
    const flyerFile = flyerInput?.files?.[0];

    if (!title) {
      setMessage({ type: "error", text: "Title is required." });
      return;
    }
    if (!startRaw || !endRaw) {
      setMessage({ type: "error", text: "Start and end time are required." });
      return;
    }

    const start_time = new Date(startRaw).toISOString();
    const end_time = new Date(endRaw).toISOString();

    if (isBefore(parseISO(end_time), parseISO(start_time))) {
      setMessage({
        type: "error",
        text: "End time must be after start time.",
      });
      return;
    }

    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) {
      setMessage({ type: "error", text: "Select a points category." });
      return;
    }

    setBusy(true);
    let flyer_url = event?.flyer_url ?? null;
    if (flyerFile) {
      const url = await uploadFlyer(flyerFile);
      if (!url) {
        setBusy(false);
        return;
      }
      flyer_url = url;
    }

    const payload = {
      title,
      description: description || null,
      location: location || null,
      start_time,
      end_time,
      point_category: categoryId,
      flyer_url,
      is_public,
    };

    const result =
      mode === "create"
        ? await createEvent(payload)
        : event
          ? await updateEvent(event.id, payload)
          : { error: "Missing event." };

    setBusy(false);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    await onSaved();
    onClose();
  };

  if (!categories.length) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
      >
        <div className="max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
          <h2 id="event-modal-title" className="text-lg font-semibold">
            No point categories
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add rows to <code className="text-xs">point_categories</code> before
            creating events.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
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
          id="event-modal-title"
          className="text-lg font-semibold text-card-foreground"
        >
          {mode === "create" ? "New event" : "Edit event"}
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
              defaultValue={event?.title ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={event?.description ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Location
            </label>
            <input
              name="location"
              defaultValue={event?.location ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Start
              </label>
              <input
                name="start_time"
                type="datetime-local"
                required
                defaultValue={toDatetimeLocalValue(event?.start_time)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                End
              </label>
              <input
                name="end_time"
                type="datetime-local"
                required
                defaultValue={toDatetimeLocalValue(event?.end_time)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Points category
            </label>
            <select
              name="category_id"
              required
              defaultValue={defaultCategoryId}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.points_value} pts)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Flyer (image)
            </label>
            <input
              name="flyer"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            {event?.flyer_url ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Current:{" "}
                <a
                  href={event.flyer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline dark:text-blue-400"
                >
                  View flyer
                </a>
                . Upload a new file to replace.
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <input
              name="is_public"
              id="event_is_public"
              type="checkbox"
              defaultChecked={event?.is_public ?? true}
              className="rounded border-border"
            />
            <label
              htmlFor="event_is_public"
              className="text-sm text-muted-foreground"
            >
              Public event
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
