"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dropzone, formatFileSize } from "@/app/components/ui/Dropzone";
import { UploadProgressBar } from "@/app/components/ui/UploadProgressBar";
import { createClient } from "@/lib/supabase/client";
import {
  AUTOFILL_SOURCES,
  OPTION_BASED_TYPES,
  QUESTION_TYPES,
  type AutofillSource,
  type FormQuestion,
  type QuestionType,
} from "@/lib/types/forms";
import { useCallback, useMemo, useState } from "react";
import type { QuestionInput } from "../../../actions";
import { uploadFormQuestionImage } from "../../../uploadFormImage";

type Props = {
  question: FormQuestion;
  onSave: (input: QuestionInput) => Promise<void>;
  onDelete: () => void;
  busy: boolean;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

type Snapshot = {
  type: QuestionType;
  label: string;
  helpText: string;
  isRequired: boolean;
  autofillSource: AutofillSource | "";
  options: string[];
  imageUrl: string | null;
};

function toSnapshot(question: FormQuestion): Snapshot {
  return {
    type: question.type,
    label: question.label,
    helpText: question.help_text ?? "",
    isRequired: question.is_required,
    autofillSource: question.autofill_source ?? "",
    options: question.options.length ? question.options.map((o) => o.label) : [""],
    imageUrl: question.image_url,
  };
}

export function QuestionEditor({ question, onSave, onDelete, busy }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id });

  const supabase = useMemo(() => createClient(), []);

  const [saved, setSaved] = useState<Snapshot>(() => toSnapshot(question));
  const [type, setType] = useState<QuestionType>(saved.type);
  const [label, setLabel] = useState(saved.label);
  const [helpText, setHelpText] = useState(saved.helpText);
  const [isRequired, setIsRequired] = useState(saved.isRequired);
  const [autofillSource, setAutofillSource] = useState(saved.autofillSource);
  const [options, setOptions] = useState<string[]>(saved.options);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageSizeLabel, setImageSizeLabel] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  const onImageFileSelected = useCallback((file: File | null) => {
    setImageFile(file);
    setImageName(file?.name ?? null);
    setImageSizeLabel(file ? formatFileSize(file.size) : null);
  }, []);

  // A text block is created via its own "Add message" button (not this Type
  // dropdown - see the note on QUESTION_TYPES in lib/types/forms.ts), so it
  // never actually changes here, but is still driven off local `type` state
  // for consistency with every other field in this editor.
  const isTextBlock = type === "text_block";
  const isOptionBased = OPTION_BASED_TYPES.includes(type);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isDirty =
    type !== saved.type ||
    label !== saved.label ||
    helpText !== saved.helpText ||
    isRequired !== saved.isRequired ||
    autofillSource !== saved.autofillSource ||
    JSON.stringify(options) !== JSON.stringify(saved.options) ||
    imageFile !== null;

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    let image_url = saved.imageUrl;
    if (imageFile) {
      setImageUploading(true);
      const uploaded = await uploadFormQuestionImage(supabase, imageFile);
      setImageUploading(false);
      if (uploaded.error) {
        setSaving(false);
        setError(uploaded.error);
        return;
      }
      image_url = uploaded.url;
    }

    const input: QuestionInput = {
      type,
      label,
      help_text: helpText || null,
      // A text block is a message, not a question - it never collects an
      // answer, so "required" doesn't apply.
      is_required: isTextBlock ? false : isRequired,
      autofill_source: isOptionBased || isTextBlock ? null : autofillSource || null,
      options: options.filter((o) => o.trim()),
      image_url: isTextBlock ? image_url : null,
    };

    await onSave(input);
    setSaving(false);
    setSaved({
      type,
      label,
      helpText,
      isRequired: input.is_required,
      autofillSource,
      options: input.options,
      imageUrl: image_url,
    });
    onImageFileSelected(null);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {isTextBlock ? "Heading" : "Question"}
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={inputClass}
              />
            </div>
            {isTextBlock ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Type
                </label>
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  Text block / message
                </p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as QuestionType)}
                  className={inputClass}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {isTextBlock ? "Message (optional)" : "Help text (optional)"}
            </label>
            {isTextBlock ? (
              <textarea
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                rows={3}
                className={inputClass}
              />
            ) : (
              <input
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                className={inputClass}
              />
            )}
          </div>

          {isTextBlock && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Image (optional)
              </label>
              <Dropzone
                id={`question-image-${question.id}`}
                accept="image/jpeg,image/png,image/webp,image/gif"
                hint="JPEG, PNG, WEBP, or GIF"
                disabled={imageUploading}
                fileName={imageName}
                fileSizeLabel={imageSizeLabel}
                onFileSelected={onImageFileSelected}
              />
              <UploadProgressBar active={imageUploading} />
              {saved.imageUrl && !imageFile && (
                // eslint-disable-next-line @next/next/no-img-element -- Image URLs come from storage / external hosts
                <img
                  src={saved.imageUrl}
                  alt=""
                  className="mt-2 max-h-32 rounded-lg border border-border object-cover"
                />
              )}
            </div>
          )}

          {isOptionBased && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Options
              </label>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      value={opt}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.map((o, i) => (i === idx ? e.target.value : o))
                        )
                      }
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="shrink-0 rounded-lg border border-border px-2 text-sm text-muted-foreground hover:bg-muted"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setOptions((prev) => [...prev, ""])}
                  className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Add option
                </button>
              </div>
            </div>
          )}

          {!isOptionBased && type !== "file_upload" && !isTextBlock && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Autofill from profile (optional)
              </label>
              <select
                value={autofillSource}
                onChange={(e) =>
                  setAutofillSource(e.target.value as AutofillSource | "")
                }
                className={inputClass}
              >
                <option value="">None</option>
                {AUTOFILL_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-between">
            {isTextBlock ? (
              <span />
            ) : (
              <label className="flex items-center gap-2 text-sm text-card-foreground">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                />
                Required
              </label>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy || saving || !isDirty || !label.trim()}
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
    </div>
  );
}
