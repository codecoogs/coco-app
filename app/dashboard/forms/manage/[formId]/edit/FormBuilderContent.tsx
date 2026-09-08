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
  createSection,
  deleteQuestion,
  deleteSection,
  getFormForEdit,
  reorderFormItems,
  setFormStatus,
  updateFormAudience,
  updateFormMeta,
  updateQuestion,
  updateSection,
  type FormItemRef,
  type PositionOption,
  type QuestionInput,
  type RoleOption,
  type SectionInput,
} from "../../../actions";
import type { FormAudienceType, FormQuestion, FormSection, FormWithQuestions } from "@/lib/types/forms";
import { QuestionEditor } from "./QuestionEditor";
import { SectionEditor } from "./SectionEditor";

type Props = {
  form: FormWithQuestions;
  roleOptions: RoleOption[];
  positionOptions: PositionOption[];
  audienceError: string | null;
};

type BuilderItem =
  | { kind: "question"; data: FormQuestion }
  | { kind: "section"; data: FormSection };

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

  // Unified, order_index-sorted view of questions + sections (sections double
  // as page breaks - see supabase/migrations/20260908010000_form_sections.sql).
  const builderItems = useMemo<BuilderItem[]>(() => {
    const items: BuilderItem[] = [
      ...form.questions.map((data) => ({ kind: "question" as const, data })),
      ...form.sections.map((data) => ({ kind: "section" as const, data })),
    ];
    return items.sort((a, b) => a.data.order_index - b.data.order_index);
  }, [form.questions, form.sections]);

  const itemIds = useMemo(() => builderItems.map((item) => item.data.id), [builderItems]);

  // --- Optimistic mutations: local state updates immediately, the server
  // call runs in the background, and only a failure triggers a message +
  // refresh() to reconcile with the server's actual state. ---

  const handleAddQuestion = useCallback(() => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticQuestion: FormQuestion = {
      id: tempId,
      form_id: form.id,
      type: "short_answer",
      label: "New question",
      help_text: null,
      is_required: false,
      order_index: builderItems.length,
      autofill_source: null,
      section_id: builderItems.length
        ? [...builderItems].reverse().find((i) => i.kind === "section")?.data.id ?? null
        : null,
      options: [],
    };
    setForm((prev) => ({ ...prev, questions: [...prev.questions, optimisticQuestion] }));

    void (async () => {
      const res = await createQuestion(form.id, {
        type: "short_answer",
        label: "New question",
        help_text: null,
        is_required: false,
        autofill_source: null,
        options: [],
      });
      if (res.error || !res.id) {
        setMessage({ type: "error", text: res.error ?? "Could not add question." });
        await refresh();
        return;
      }
      const realId = res.id;
      setForm((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === tempId ? { ...q, id: realId } : q
        ),
      }));
    })();
  }, [form.id, builderItems, refresh]);

  const handleAddSection = useCallback(() => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticSection: FormSection = {
      id: tempId,
      form_id: form.id,
      title: "New section",
      description: null,
      order_index: builderItems.length,
    };
    setForm((prev) => ({ ...prev, sections: [...prev.sections, optimisticSection] }));

    void (async () => {
      const res = await createSection(form.id, { title: "New section", description: null });
      if (res.error || !res.id) {
        setMessage({ type: "error", text: res.error ?? "Could not add section." });
        await refresh();
        return;
      }
      const realId = res.id;
      setForm((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === tempId ? { ...s, id: realId } : s
        ),
      }));
    })();
  }, [form.id, builderItems, refresh]);

  const handleSaveQuestion = useCallback(
    (questionId: string, input: QuestionInput) => {
      setForm((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId
            ? {
                ...q,
                type: input.type,
                label: input.label,
                help_text: input.help_text,
                is_required: input.is_required,
                autofill_source: input.autofill_source,
                options: input.options.map((label, idx) => ({
                  id: `${questionId}-opt-${idx}`,
                  question_id: questionId,
                  label,
                  order_index: idx,
                })),
              }
            : q
        ),
      }));

      void (async () => {
        const res = await updateQuestion(questionId, input);
        if (res.error) {
          setMessage({ type: "error", text: res.error });
          await refresh();
        }
      })();
    },
    [refresh]
  );

  const handleSaveSection = useCallback(
    (sectionId: string, input: SectionInput) => {
      setForm((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, title: input.title, description: input.description } : s
        ),
      }));

      void (async () => {
        const res = await updateSection(sectionId, input);
        if (res.error) {
          setMessage({ type: "error", text: res.error });
          await refresh();
        }
      })();
    },
    [refresh]
  );

  const handleDeleteQuestion = useCallback(
    (questionId: string) => {
      if (!confirm("Delete this question? This cannot be undone.")) return;
      setForm((prev) => ({
        ...prev,
        questions: prev.questions.filter((q) => q.id !== questionId),
      }));

      void (async () => {
        const res = await deleteQuestion(questionId, form.id);
        if (res.error) {
          setMessage({ type: "error", text: res.error });
          await refresh();
        }
      })();
    },
    [form.id, refresh]
  );

  const handleDeleteSection = useCallback(
    (sectionId: string) => {
      if (
        !confirm(
          "Delete this section? Its questions move to the previous page rather than being deleted."
        )
      )
        return;
      setForm((prev) => ({
        ...prev,
        sections: prev.sections.filter((s) => s.id !== sectionId),
        questions: prev.questions.map((q) =>
          q.section_id === sectionId ? { ...q, section_id: null } : q
        ),
      }));

      void (async () => {
        const res = await deleteSection(sectionId, form.id);
        if (res.error) {
          setMessage({ type: "error", text: res.error });
          await refresh();
        }
      })();
    },
    [form.id, refresh]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = builderItems.findIndex((item) => item.data.id === active.id);
      const newIndex = builderItems.findIndex((item) => item.data.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(builderItems, oldIndex, newIndex);

      // Derive each question's section_id from the nearest preceding section
      // in the new order, mirroring reorderFormItems' server-side logic, so
      // the local view is correct immediately instead of waiting on refresh().
      let currentSectionId: string | null = null;
      const nextQuestions = new Map(form.questions.map((q) => [q.id, q]));
      const nextSections = new Map(form.sections.map((s) => [s.id, s]));
      reordered.forEach((item, idx) => {
        if (item.kind === "section") {
          currentSectionId = item.data.id;
          nextSections.set(item.data.id, { ...item.data, order_index: idx });
        } else {
          nextQuestions.set(item.data.id, {
            ...item.data,
            order_index: idx,
            section_id: currentSectionId,
          });
        }
      });

      setForm((prev) => ({
        ...prev,
        questions: Array.from(nextQuestions.values()),
        sections: Array.from(nextSections.values()),
      }));

      const items: FormItemRef[] = reordered.map((item) => ({
        id: item.data.id,
        kind: item.kind,
      }));

      void (async () => {
        const res = await reorderFormItems(form.id, items);
        if (res.error) {
          setMessage({ type: "error", text: res.error });
          await refresh();
        }
      })();
    },
    [form.id, form.questions, form.sections, builderItems, refresh]
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddSection}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted"
            >
              Add section
            </button>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted"
            >
              Add question
            </button>
          </div>
        </div>

        {!builderItems.length ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No questions yet. Add one to get started.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {builderItems.map((item) =>
                  item.kind === "section" ? (
                    <SectionEditor
                      key={item.data.id}
                      section={item.data}
                      onSave={(input) => handleSaveSection(item.data.id, input)}
                      onDelete={() => handleDeleteSection(item.data.id)}
                    />
                  ) : (
                    <QuestionEditor
                      key={item.data.id}
                      question={item.data}
                      busy={busy}
                      onSave={(input) => handleSaveQuestion(item.data.id, input)}
                      onDelete={() => handleDeleteQuestion(item.data.id)}
                    />
                  )
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  );
}
