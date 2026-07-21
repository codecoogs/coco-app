"use client";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  createQuestion,
  deleteQuestion,
  getFormForEdit,
  reorderQuestions,
  setFormStatus,
  updateFormAudience,
  updateFormMeta,
  updateQuestion,
  type PositionOption,
  type QuestionInput,
  type RoleOption,
} from "../../../actions";
import type { FormAudienceType, FormWithQuestions } from "@/lib/types/forms";
import { QuestionEditor } from "./QuestionEditor";

type Props = {
  form: FormWithQuestions;
  roleOptions: RoleOption[];
  positionOptions: PositionOption[];
  audienceError: string | null;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground";

export function FormBuilderContent({
  form: initialForm,
  roleOptions,
  positionOptions,
  audienceError,
}: Props) {
  const [form, setForm] = useState(initialForm);
  const [title, setTitle] = useState(initialForm.title);
  const [description, setDescription] = useState(initialForm.description ?? "");
  const [audienceType, setAudienceType] = useState<FormAudienceType>(
    initialForm.audience_type
  );
  const [roleIds, setRoleIds] = useState<number[]>(initialForm.role_ids);
  const [positionIds, setPositionIds] = useState<number[]>(initialForm.position_ids);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    null
  );

  const sensors = useSensors(useSensor(PointerSensor));

  const refresh = useCallback(async () => {
    const res = await getFormForEdit(initialForm.id);
    if (res.error || !res.data) {
      setMessage({ type: "error", text: res.error ?? "Could not reload form." });
      return;
    }
    setForm(res.data);
  }, [initialForm.id]);

  const handleSaveMeta = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const res = await updateFormMeta(form.id, { title, description });
    setBusy(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setMessage({ type: "ok", text: "Saved." });
  }, [form.id, title, description]);

  const handleSaveAudience = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const res = await updateFormAudience(form.id, {
      audience_type: audienceType,
      role_ids: roleIds,
      position_ids: positionIds,
    });
    setBusy(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setMessage({ type: "ok", text: "Audience updated." });
    await refresh();
  }, [form.id, audienceType, roleIds, positionIds, refresh]);

  const handleAddQuestion = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const res = await createQuestion(form.id, {
      type: "short_answer",
      label: "New question",
      help_text: null,
      is_required: false,
      autofill_source: null,
      options: [],
    });
    setBusy(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    await refresh();
  }, [form.id, refresh]);

  const handleSaveQuestion = useCallback(
    async (questionId: string, input: QuestionInput) => {
      setBusy(true);
      const res = await updateQuestion(questionId, input);
      setBusy(false);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      await refresh();
    },
    [refresh]
  );

  const handleDeleteQuestion = useCallback(
    async (questionId: string) => {
      if (!confirm("Delete this question? This cannot be undone.")) return;
      setBusy(true);
      const res = await deleteQuestion(questionId, form.id);
      setBusy(false);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      await refresh();
    },
    [form.id, refresh]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = form.questions.findIndex((q) => q.id === active.id);
      const newIndex = form.questions.findIndex((q) => q.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(form.questions, oldIndex, newIndex);
      setForm((prev) => ({ ...prev, questions: reordered }));

      const res = await reorderQuestions(
        form.id,
        reordered.map((q) => q.id)
      );
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        await refresh();
      }
    },
    [form.id, form.questions, refresh]
  );

  const handlePublishToggle = useCallback(async () => {
    setBusy(true);
    const next = form.status === "published" ? "closed" : "published";
    const res = await setFormStatus(form.id, next);
    setBusy(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    await refresh();
  }, [form.id, form.status, refresh]);

  const questionIds = useMemo(() => form.questions.map((q) => q.id), [form.questions]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/forms/manage"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to forms
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Edit form</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/dashboard/forms/manage/${form.id}/preview`}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            Preview
          </Link>
          <Link
            href={`/dashboard/forms/manage/${form.id}/responses`}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            Responses
          </Link>
          <button
            type="button"
            onClick={handlePublishToggle}
            disabled={busy}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
          >
            {form.status === "published" ? "Close form" : "Publish form"}
          </button>
        </div>
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

      <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-card-foreground">Details</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={handleSaveMeta}
          disabled={busy || !title.trim()}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Save details
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-card-foreground">Audience</h2>
        <p className="text-sm text-muted-foreground">
          Choose who can see and respond to this form.
        </p>
        {audienceError && (
          <p className="text-sm text-red-600 dark:text-red-400">{audienceError}</p>
        )}
        <div className="flex flex-wrap gap-4">
          {(["everyone", "roles", "positions"] as FormAudienceType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm capitalize">
              <input
                type="radio"
                name="audience_type"
                checked={audienceType === t}
                onChange={() => setAudienceType(t)}
              />
              {t}
            </label>
          ))}
        </div>

        {audienceType === "roles" && (
          <div className="flex flex-wrap gap-3">
            {roleOptions.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roleIds.includes(r.id)}
                  onChange={(e) =>
                    setRoleIds((prev) =>
                      e.target.checked
                        ? [...prev, r.id]
                        : prev.filter((id) => id !== r.id)
                    )
                  }
                />
                {r.name}
              </label>
            ))}
          </div>
        )}

        {audienceType === "positions" && (
          <div className="flex flex-wrap gap-3">
            {positionOptions.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={positionIds.includes(p.id)}
                  onChange={(e) =>
                    setPositionIds((prev) =>
                      e.target.checked
                        ? [...prev, p.id]
                        : prev.filter((id) => id !== p.id)
                    )
                  }
                />
                {p.title}
              </label>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveAudience}
          disabled={busy}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Save audience
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Questions</h2>
          <button
            type="button"
            onClick={handleAddQuestion}
            disabled={busy}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
          >
            Add question
          </button>
        </div>

        {!form.questions.length ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No questions yet. Add one to get started.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={questionIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {form.questions.map((q) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    busy={busy}
                    onSave={(input) => handleSaveQuestion(q.id, input)}
                    onDelete={() => handleDeleteQuestion(q.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  );
}
