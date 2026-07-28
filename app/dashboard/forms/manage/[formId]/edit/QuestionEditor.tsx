"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AUTOFILL_SOURCES,
  OPTION_BASED_TYPES,
  QUESTION_TYPES,
  type AutofillSource,
  type FormQuestion,
  type QuestionType,
} from "@/lib/types/forms";
import { useState } from "react";
import type { QuestionInput } from "../../../actions";

type Props = {
  question: FormQuestion;
  onSave: (input: QuestionInput) => Promise<void>;
  onDelete: () => Promise<void>;
  busy: boolean;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

export function QuestionEditor({ question, onSave, onDelete, busy }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id });

  const [type, setType] = useState<QuestionType>(question.type);
  const [label, setLabel] = useState(question.label);
  const [helpText, setHelpText] = useState(question.help_text ?? "");
  const [isRequired, setIsRequired] = useState(question.is_required);
  const [autofillSource, setAutofillSource] = useState<AutofillSource | "">(
    question.autofill_source ?? ""
  );
  const [options, setOptions] = useState<string[]>(
    question.options.length ? question.options.map((o) => o.label) : [""]
  );
  const [saving, setSaving] = useState(false);

  const isOptionBased = OPTION_BASED_TYPES.includes(type);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      type,
      label,
      help_text: helpText || null,
      is_required: isRequired,
      autofill_source: isOptionBased ? null : autofillSource || null,
      options: options.filter((o) => o.trim()),
    });
    setSaving(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-2 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          ⠿
        </button>

        <div className="flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Question
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={inputClass}
              />
            </div>
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Help text (optional)
            </label>
            <input
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              className={inputClass}
            />
          </div>

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

          {!isOptionBased && type !== "file_upload" && (
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

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-card-foreground">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
              />
              Required
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onDelete}
                disabled={busy || saving}
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy || saving || !label.trim()}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
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
