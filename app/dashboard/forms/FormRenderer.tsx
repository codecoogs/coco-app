"use client";

import type { AnswerValue, FormQuestion } from "@/lib/types/forms";

type Props = {
  questions: FormQuestion[];
  answers: Record<string, AnswerValue>;
  onAnswerChange: (questionId: string, next: AnswerValue) => void;
  onFileSelect?: (questionId: string, file: File) => void;
  uploadingQuestionId?: string | null;
  disabled?: boolean;
  previewMode?: boolean;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground disabled:opacity-60";

export function FormRenderer({
  questions,
  answers,
  onAnswerChange,
  onFileSelect,
  uploadingQuestionId,
  disabled = false,
  previewMode = false,
}: Props) {
  return (
    <div className="space-y-5">
      {previewMode && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Preview mode — responses are not saved here.
        </div>
      )}

      {questions.map((q) => {
        const answer = answers[q.id] ?? {};
        return (
          <div
            key={q.id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <label className="block text-sm font-medium text-card-foreground">
              {q.label}
              {q.is_required && <span className="ml-1 text-red-500">*</span>}
            </label>
            {q.help_text && (
              <p className="mt-1 text-xs text-muted-foreground">{q.help_text}</p>
            )}

            <div className="mt-2">
              {q.type === "short_answer" && (
                <input
                  type="text"
                  value={answer.value ?? ""}
                  disabled={disabled}
                  onChange={(e) => onAnswerChange(q.id, { value: e.target.value })}
                  className={inputClass}
                />
              )}

              {q.type === "paragraph" && (
                <textarea
                  value={answer.value ?? ""}
                  disabled={disabled}
                  rows={4}
                  onChange={(e) => onAnswerChange(q.id, { value: e.target.value })}
                  className={inputClass}
                />
              )}

              {q.type === "date" && (
                <input
                  type="date"
                  value={answer.value ?? ""}
                  disabled={disabled}
                  onChange={(e) => onAnswerChange(q.id, { value: e.target.value })}
                  className={inputClass}
                />
              )}

              {q.type === "dropdown" && (
                <select
                  value={answer.value ?? ""}
                  disabled={disabled}
                  onChange={(e) => onAnswerChange(q.id, { value: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select…</option>
                  {q.options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {q.type === "single_select" && (
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 text-sm text-card-foreground"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        disabled={disabled}
                        checked={answer.value === opt.id}
                        onChange={() => onAnswerChange(q.id, { value: opt.id })}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}

              {q.type === "multi_select" && (
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const selected = answer.selectedOptionIds ?? [];
                    const checked = selected.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className="flex items-center gap-2 text-sm text-card-foreground"
                      >
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={checked}
                          onChange={() =>
                            onAnswerChange(q.id, {
                              selectedOptionIds: checked
                                ? selected.filter((id) => id !== opt.id)
                                : [...selected, opt.id],
                            })
                          }
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              )}

              {q.type === "file_upload" && (
                <div className="space-y-2">
                  {answer.fileName && (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <span className="truncate text-foreground">
                        {answer.fileName}
                      </span>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() =>
                            onAnswerChange(q.id, { filePath: null, fileName: null })
                          }
                          className="ml-2 shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                  {!disabled && (
                    <input
                      type="file"
                      disabled={uploadingQuestionId === q.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onFileSelect) onFileSelect(q.id, file);
                        e.target.value = "";
                      }}
                      className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-card-foreground hover:file:bg-muted"
                    />
                  )}
                  {uploadingQuestionId === q.id && (
                    <p className="text-xs text-muted-foreground">Uploading…</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
