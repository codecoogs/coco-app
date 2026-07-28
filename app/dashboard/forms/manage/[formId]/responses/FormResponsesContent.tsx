"use client";

import { downloadCsv } from "@/lib/csv";
import type { FormQuestion, ResponseRow } from "@/lib/types/forms";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { getSignedFileUrl } from "../../../actions";

type Props = {
  formId: string;
  formTitle: string;
  questions: FormQuestion[];
  initialResponses: ResponseRow[];
  loadError: string | null;
};

function optionLabel(question: FormQuestion, optionId: string | null | undefined) {
  if (!optionId) return "";
  return question.options.find((o) => o.id === optionId)?.label ?? "";
}

function answerText(question: FormQuestion, response: ResponseRow): string {
  const a = response.answers[question.id];
  if (!a) return "";
  if (question.type === "multi_select") {
    return (a.selectedOptionIds ?? [])
      .map((id) => optionLabel(question, id))
      .filter(Boolean)
      .join("; ");
  }
  if (question.type === "single_select" || question.type === "dropdown") {
    return optionLabel(question, a.value);
  }
  if (question.type === "file_upload") {
    return a.filePath ?? "";
  }
  return a.value ?? "";
}

export function FormResponsesContent({
  formId,
  formTitle,
  questions,
  initialResponses,
  loadError,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = useCallback(() => {
    const header = [
      "First name",
      "Last name",
      "Email",
      "Submitted",
      "Updated",
      ...questions.map((q) => q.label),
    ];
    const rows = initialResponses.map((r) => [
      r.first_name ?? "",
      r.last_name ?? "",
      r.email ?? "",
      r.submitted_at,
      r.updated_at,
      ...questions.map((q) => answerText(q, r)),
    ]);
    downloadCsv([header, ...rows], `${formTitle.replace(/[^a-zA-Z0-9-_]/g, "_")}-responses.csv`);
  }, [formTitle, initialResponses, questions]);

  const handleViewFile = useCallback(async (filePath: string) => {
    setMessage(null);
    const res = await getSignedFileUrl(filePath);
    if (res.error || !res.url) {
      setMessage(res.error ?? "Could not open file.");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }, []);

  const fileQuestions = useMemo(
    () => questions.filter((q) => q.type === "file_upload"),
    [questions]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/dashboard/forms/manage/${formId}/edit`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to builder
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {formTitle} — Responses
          </h1>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={!initialResponses.length}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {loadError}
        </div>
      )}
      {message && <p className="text-sm text-red-600 dark:text-red-400">{message}</p>}

      {!initialResponses.length ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No responses yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Respondent</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                {questions.map((q) => (
                  <th key={q.id} className="px-4 py-3 font-medium">
                    {q.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialResponses.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground">
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.submitted_at).toLocaleString()}
                  </td>
                  {questions.map((q) => (
                    <td key={q.id} className="px-4 py-3 text-foreground">
                      {q.type === "file_upload" ? (
                        r.answers[q.id]?.filePath ? (
                          <button
                            type="button"
                            onClick={() => handleViewFile(r.answers[q.id]!.filePath!)}
                            className="text-xs font-medium text-foreground hover:underline"
                          >
                            View file
                          </button>
                        ) : (
                          "—"
                        )
                      ) : (
                        answerText(q, r) || "—"
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fileQuestions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          File uploads open via a temporary signed link (10 minutes).
        </p>
      )}
    </div>
  );
}
