"use client";

import { createClient } from "@/lib/supabase/client";
import { safeFileName, uploadWithTimeout } from "@/lib/supabase/upload";
import { groupFormPages, isQuestionAnswered, type AnswerValue } from "@/lib/types/forms";
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

  const pages = useMemo(
    () => groupFormPages(form.questions, form.sections),
    [form.questions, form.sections]
  );
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages[pageIndex] ?? null;
  const isLastPage = pageIndex >= pages.length - 1;
  const bannerUrl = page?.section?.banner_url ?? form.banner_url ?? null;

  const handleAnswerChange = useCallback((questionId: string, next: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...next } }));
  }, []);

  const handleFileSelect = useCallback(
    async (questionId: string, file: File) => {
      setMessage(null);
      setUploadingQuestionId(questionId);

      // try/finally: every exit path has to clear the spinner. Before this, a
      // throw from ensureResponseId or a stalled upload left "Uploading..." on
      // screen forever with no error and no way to retry.
      try {
        let rid = responseId;
        if (!rid) {
          const res = await ensureResponseId(form.id);
          if (!res.id) {
            setMessage({ type: "error", text: res.error ?? "Could not start response." });
            return;
          }
          rid = res.id;
          setResponseId(rid);
        }

        const path = `${rid}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error } = await uploadWithTimeout(
          supabase,
          "form-uploads",
          path,
          file,
          { label: "File upload" }
        );
        if (error) {
          setMessage({ type: "error", text: error });
          return;
        }

        handleAnswerChange(questionId, { filePath: path, fileName: file.name });
      } catch (err) {
        setMessage({
          type: "error",
          text: err instanceof Error ? err.message : "File upload failed.",
        });
      } finally {
        setUploadingQuestionId(null);
      }
    },
    [form.id, handleAnswerChange, responseId, supabase]
  );

  const handleNext = useCallback(() => {
    if (!page) return;
    const unanswered = page.questions.find(
      (q) => q.is_required && !isQuestionAnswered(answers[q.id])
    );
    if (unanswered) {
      setMessage({ type: "error", text: "Please answer all required questions on this page." });
      return;
    }
    setMessage(null);
    setPageIndex((i) => Math.min(i + 1, pages.length - 1));
  }, [page, answers, pages.length]);

  const handleBack = useCallback(() => {
    setMessage(null);
    setPageIndex((i) => Math.max(i - 1, 0));
  }, []);

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

      {!pages.length ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          This form has no questions yet.
        </div>
      ) : (
        <>
          {bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- Banner URLs come from storage / external hosts
            <img
              src={bannerUrl}
              alt=""
              className="max-h-64 w-full rounded-xl object-cover"
            />
          )}

          {page?.section && (
            <div>
              <h2 className="text-xl font-semibold text-foreground">{page.section.title}</h2>
              {page.section.description && (
                <p className="mt-1 text-muted-foreground">{page.section.description}</p>
              )}
            </div>
          )}

          <FormRenderer
            questions={page?.questions ?? []}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            onFileSelect={handleFileSelect}
            uploadingQuestionId={uploadingQuestionId}
            disabled={closed}
          />

          {!closed && (
            <div className="flex items-center justify-between">
              {pageIndex > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
                >
                  Back
                </button>
              ) : (
                <span />
              )}

              {isLastPage ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={busy || uploadingQuestionId !== null}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
                >
                  {busy ? "Submitting…" : alreadySubmitted ? "Update response" : "Submit"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={uploadingQuestionId !== null}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
                >
                  Next
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
