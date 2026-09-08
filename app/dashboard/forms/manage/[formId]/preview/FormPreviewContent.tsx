"use client";

import { groupFormPages, isQuestionAnswered, type AnswerValue, type FormWithQuestions } from "@/lib/types/forms";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormRenderer } from "../../../FormRenderer";

type Props = {
  form: FormWithQuestions;
};

export function FormPreviewContent({ form }: Props) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [filePreviewUrls, setFilePreviewUrls] = useState<Record<string, string>>({});

  const filePreviewUrlsRef = useRef(filePreviewUrls);
  useEffect(() => {
    filePreviewUrlsRef.current = filePreviewUrls;
  }, [filePreviewUrls]);
  useEffect(
    () => () => {
      Object.values(filePreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

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
    if (next.fileName === null) {
      setFilePreviewUrls((prev) => {
        const url = prev[questionId];
        if (!url) return prev;
        URL.revokeObjectURL(url);
        const rest = { ...prev };
        delete rest[questionId];
        return rest;
      });
    }
  }, []);

  const handleFileSelect = useCallback(
    (questionId: string, file: File) => {
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setFilePreviewUrls((prev) => {
          const old = prev[questionId];
          if (old) URL.revokeObjectURL(old);
          return { ...prev, [questionId]: url };
        });
      }
      handleAnswerChange(questionId, { fileName: file.name });
    },
    [handleAnswerChange]
  );

  const handleNext = useCallback(() => {
    if (!page) return;
    const unanswered = page.questions.find(
      (q) => q.is_required && !isQuestionAnswered(answers[q.id])
    );
    if (unanswered) {
      setMessage("Please answer all required questions on this page.");
      return;
    }
    setMessage(null);
    setPageIndex((i) => Math.min(i + 1, pages.length - 1));
  }, [page, answers, pages.length]);

  const handleBack = useCallback(() => {
    setMessage(null);
    setPageIndex((i) => Math.max(i - 1, 0));
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/dashboard/forms/manage/${form.id}/edit`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to builder
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">{form.title}</h1>
        {form.description && (
          <p className="mt-1 whitespace-pre-line text-muted-foreground">
            {form.description}
          </p>
        )}
      </div>

      {message && <p className="text-sm text-red-600 dark:text-red-400">{message}</p>}

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
                <p className="mt-1 whitespace-pre-line text-muted-foreground">
                  {page.section.description}
                </p>
              )}
            </div>
          )}

          <FormRenderer
            questions={page?.questions ?? []}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            onFileSelect={handleFileSelect}
            filePreviewUrls={filePreviewUrls}
            previewMode
          />

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

            {!isLastPage && (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
              >
                Next
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
