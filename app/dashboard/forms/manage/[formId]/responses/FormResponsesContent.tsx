"use client";

import { downloadCsv } from "@/lib/csv";
import type { FormQuestion, ResponseRow } from "@/lib/types/forms";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [openResponseId, setOpenResponseId] = useState<string | null>(null);

  useEffect(() => {
    if (!openResponseId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenResponseId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openResponseId]);

  // Text blocks are messages, not questions - they never collect an answer,
  // so they don't belong as a column here.
  const answerableQuestions = useMemo(
    () => questions.filter((q) => q.type !== "text_block"),
    [questions]
  );

  const handleExport = useCallback(() => {
    const header = [
      "First name",
      "Last name",
      "Email",
      "Submitted",
      "Updated",
      ...answerableQuestions.map((q) => q.label),
    ];
    const rows = initialResponses.map((r) => [
      r.first_name ?? "",
      r.last_name ?? "",
      r.email ?? "",
      r.submitted_at,
      r.updated_at,
      ...answerableQuestions.map((q) => answerText(q, r)),
    ]);
    downloadCsv([header, ...rows], `${formTitle.replace(/[^a-zA-Z0-9-_]/g, "_")}-responses.csv`);
  }, [formTitle, initialResponses, answerableQuestions]);

  const handleViewFile = useCallback(async (filePath: string) => {
    setMessage(null);

    // Opened synchronously, before awaiting the signed URL: a window.open that
    // runs after an await has lost the click's user-activation and gets blocked
    // as a popup. Also no features string - passing one makes browsers open a
    // stripped popup window rather than a normal tab.
    const tab = window.open("", "_blank");

    const res = await getSignedFileUrl(filePath);
    if (res.error || !res.url) {
      tab?.close();
      setMessage(res.error ?? "Could not open file.");
      return;
    }

    if (tab) {
      // Stand in for rel="noopener" now that the features string is gone.
      tab.opener = null;
      tab.location.replace(res.url);
    } else {
      // Popups blocked entirely - fall back to the current tab rather than
      // silently doing nothing.
      window.location.href = res.url;
    }
  }, []);

  const fileQuestions = useMemo(
    () => answerableQuestions.filter((q) => q.type === "file_upload"),
    [answerableQuestions]
  );

  const openResponse = useMemo(
    () => initialResponses.find((r) => r.id === openResponseId) ?? null,
    [initialResponses, openResponseId]
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
                {answerableQuestions.map((q) => (
                  <th key={q.id} className="px-4 py-3 font-medium">
                    {q.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialResponses.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setOpenResponseId(r.id)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted"
                >
                  <td className="px-4 py-3 text-foreground">
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.submitted_at).toLocaleString()}
                  </td>
                  {answerableQuestions.map((q) => (
                    <td key={q.id} className="px-4 py-3 text-foreground">
                      {q.type === "file_upload" ? (
                        r.answers[q.id]?.filePath ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewFile(r.answers[q.id]!.filePath!);
                            }}
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

      {openResponse ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full response"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenResponseId(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">
                  {[openResponse.first_name, openResponse.last_name]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </h3>
                <p className="text-sm text-muted-foreground">{openResponse.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted {new Date(openResponse.submitted_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenResponseId(null)}
                aria-label="Close"
                className="shrink-0 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              {answerableQuestions.map((q) => {
                const filePath = openResponse.answers[q.id]?.filePath;
                return (
                  <div key={q.id} className="border-t border-border pt-3">
                    <dt className="font-medium text-muted-foreground">{q.label}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-card-foreground">
                      {q.type === "file_upload" ? (
                        filePath ? (
                          <button
                            type="button"
                            onClick={() => handleViewFile(filePath)}
                            className="font-medium text-foreground hover:underline"
                          >
                            View file
                          </button>
                        ) : (
                          "—"
                        )
                      ) : (
                        answerText(q, openResponse) || "—"
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
