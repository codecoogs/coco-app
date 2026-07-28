"use client";

import { createClient } from "@/lib/supabase/client";
import type { AnswerValue } from "@/lib/types/forms";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ensureResponseId, submitResponse, type FillableForm } from "../actions";
import { FormRenderer } from "../FormRenderer";

type Props = {
  form: FillableForm;
  initialAnswers: Record<string, AnswerValue>;
  initialResponseId: string | null;
};

export function FormFillContent({ form, initialAnswers, initialResponseId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(initialAnswers);
  const [responseId, setResponseId] = useState<string | null>(initialResponseId);
  const [busy, setBusy] = useState(false);
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    null
  );

  const closed = form.status === "closed";
  const alreadySubmitted = initialResponseId !== null;

  const handleAnswerChange = useCallback((questionId: string, next: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...next } }));
  }, []);

  const handleFileSelect = useCallback(
    async (questionId: string, file: File) => {
      setMessage(null);
      setUploadingQuestionId(questionId);

      let rid = responseId;
      if (!rid) {
        const res = await ensureResponseId(form.id);
        if (!res.id) {
          setMessage({ type: "error", text: res.error ?? "Could not start response." });
          setUploadingQuestionId(null);
          return;
        }
        rid = res.id;
        setResponseId(rid);
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${rid}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage
        .from("form-uploads")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      setUploadingQuestionId(null);

      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }

      handleAnswerChange(questionId, { filePath: path, fileName: file.name });
    },
    [form.id, handleAnswerChange, responseId, supabase]
  );

  const handleSubmit = useCallback(async () => {
    setMessage(null);
    setBusy(true);
    const res = await submitResponse(form.id, answers);
    setBusy(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setMessage({ type: "ok", text: "Response submitted." });
  }, [answers, form.id]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/forms"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to forms
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">{form.title}</h1>
        {form.description && (
          <p className="mt-1 text-muted-foreground">{form.description}</p>
        )}
      </div>

      {closed ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          This form is closed and no longer accepting responses.
        </div>
      ) : (
        <>
          {alreadySubmitted && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
              You&apos;ve already submitted a response — feel free to update it below.
            </div>
          )}

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
        </>
      )}

      <FormRenderer
        questions={form.questions}
        answers={answers}
        onAnswerChange={handleAnswerChange}
        onFileSelect={handleFileSelect}
        uploadingQuestionId={uploadingQuestionId}
        disabled={closed}
      />

      {!closed && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || uploadingQuestionId !== null}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
        >
          {busy ? "Submitting…" : alreadySubmitted ? "Update response" : "Submit"}
        </button>
      )}
    </div>
  );
}
