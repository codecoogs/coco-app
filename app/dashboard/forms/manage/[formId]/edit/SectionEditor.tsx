"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dropzone, formatFileSize } from "@/app/components/ui/Dropzone";
import { UploadProgressBar } from "@/app/components/ui/UploadProgressBar";
import { createClient } from "@/lib/supabase/client";
import type { FormSection } from "@/lib/types/forms";
import { useCallback, useMemo, useState } from "react";
import type { SectionInput } from "../../../actions";
import { uploadFormBanner } from "../../../uploadFormImage";

type Props = {
  section: FormSection;
  onSave: (input: SectionInput) => Promise<void>;
  onDelete: () => void;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

type Snapshot = {
  title: string;
  description: string;
  bannerUrl: string | null;
};

function toSnapshot(section: FormSection): Snapshot {
  return {
    title: section.title,
    description: section.description ?? "",
    bannerUrl: section.banner_url,
  };
}

/** A title/description text block that also marks a page break - see form_sections in supabase/migrations/20260908010000_form_sections.sql. */
export function SectionEditor({ section, onSave, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const supabase = useMemo(() => createClient(), []);
  const [saved, setSaved] = useState<Snapshot>(() => toSnapshot(section));
  const [title, setTitle] = useState(saved.title);
  const [description, setDescription] = useState(saved.description);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerName, setBannerName] = useState<string | null>(null);
  const [bannerSizeLabel, setBannerSizeLabel] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onBannerFileSelected = useCallback((file: File | null) => {
    setBannerFile(file);
    setBannerName(file?.name ?? null);
    setBannerSizeLabel(file ? formatFileSize(file.size) : null);
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isDirty =
    title !== saved.title || description !== saved.description || bannerFile !== null;

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    let banner_url = saved.bannerUrl;
    if (bannerFile) {
      setBannerUploading(true);
      const res = await uploadFormBanner(supabase, bannerFile);
      setBannerUploading(false);
      if (res.error) {
        setSaving(false);
        setError(res.error);
        return;
      }
      banner_url = res.url;
    }

    await onSave({ title, description: description || null, banner_url });
    setSaving(false);
    setSaved({ title, description, bannerUrl: banner_url });
    onBannerFileSelected(null);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-4"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none self-stretch text-muted-foreground hover:text-foreground active:cursor-grabbing flex items-center"
          aria-label="Drag to reorder"
        >
          ⠿
        </button>

        <div className="flex-1 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Section — starts a new page
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Section title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Banner (optional — overrides the form&apos;s banner on this page)
            </label>
            <Dropzone
              id={`section-banner-${section.id}`}
              accept="image/jpeg,image/png,image/webp,image/gif"
              hint="JPEG, PNG, WEBP, or GIF"
              disabled={bannerUploading}
              fileName={bannerName}
              fileSizeLabel={bannerSizeLabel}
              onFileSelected={onBannerFileSelected}
            />
            <UploadProgressBar active={bannerUploading} />
            {saved.bannerUrl && !bannerFile && (
              // eslint-disable-next-line @next/next/no-img-element -- Banner URLs come from storage / external hosts
              <img
                src={saved.bannerUrl}
                alt=""
                className="mt-2 max-h-32 w-full rounded-lg border border-border object-cover"
              />
            )}
            {error && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onDelete}
              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Delete section
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim() || saving || !isDirty}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                isDirty
                  ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
