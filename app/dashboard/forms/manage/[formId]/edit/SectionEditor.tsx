"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormSection } from "@/lib/types/forms";
import { useState } from "react";
import type { SectionInput } from "../../../actions";

type Props = {
  section: FormSection;
  onSave: (input: SectionInput) => void;
  onDelete: () => void;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

/** A title/description text block that also marks a page break - see form_sections in supabase/migrations/20260908010000_form_sections.sql. */
export function SectionEditor({ section, onSave, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const [title, setTitle] = useState(section.title);
  const [description, setDescription] = useState(section.description ?? "");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    onSave({ title, description: description || null });
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
              disabled={!title.trim()}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
