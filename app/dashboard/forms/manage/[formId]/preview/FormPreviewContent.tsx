"use client";

import type { AnswerValue, FormWithQuestions } from "@/lib/types/forms";
import Link from "next/link";
import { useCallback, useState } from "react";
import { FormRenderer } from "../../../FormRenderer";

type Props = {
  form: FormWithQuestions;
};

export function FormPreviewContent({ form }: Props) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});

  const handleAnswerChange = useCallback((questionId: string, next: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...next } }));
  }, []);

  const handleFileSelect = useCallback((questionId: string, file: File) => {
    handleAnswerChange(questionId, { fileName: file.name });
  }, [handleAnswerChange]);

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
          <p className="mt-1 text-muted-foreground">{form.description}</p>
        )}
      </div>

      {!form.questions.length ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          This form has no questions yet.
        </div>
      ) : (
        <FormRenderer
          questions={form.questions}
          answers={answers}
          onAnswerChange={handleAnswerChange}
          onFileSelect={handleFileSelect}
          previewMode
        />
      )}
    </div>
  );
}
