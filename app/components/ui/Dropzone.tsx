"use client";

import { useCallback, useState } from "react";

/**
 * Shared CSV/file dropzone: drag-hover gives three signals (glow, copy shift,
 * scale) instead of a static box. File selection is handled by the caller
 * (onFileSelected) — this component only owns drag-hover visual state.
 */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type DropzoneProps = {
  id: string;
  accept: string;
  hint?: string;
  disabled?: boolean;
  fileName?: string | null;
  fileSizeLabel?: string | null;
  onFileSelected: (file: File | null) => void;
};

export function Dropzone({
  id,
  accept,
  hint = "CSV files only",
  disabled = false,
  fileName,
  fileSizeLabel,
  onFileSelected,
}: DropzoneProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (disabled) return;
      onFileSelected(e.dataTransfer.files?.[0] ?? null);
    },
    [disabled, onFileSelected]
  );

  return (
    <div>
      <div className="flex w-full items-center justify-center">
        <label
          htmlFor={id}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDrop={handleDrop}
          className={`flex h-40 w-full flex-col items-center justify-center rounded-lg border p-4 transition-all duration-150 ${
            disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
          } ${
            dragActive
              ? "scale-[1.02] border-blue-500 bg-blue-500/10 shadow-[0_0_0_4px_rgba(37,99,235,0.18)]"
              : "border-dashed border-border bg-muted/30 hover:bg-muted/40"
          }`}
        >
          <div className="flex flex-col items-center justify-center text-sm text-muted-foreground">
            <svg
              className={`mb-3 h-8 w-8 transition-colors ${dragActive ? "text-blue-500" : ""}`}
              aria-hidden
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 17h3a3 3 0 0 0 0-6h-.025a5.56 5.56 0 0 0 .025-.5A5.5 5.5 0 0 0 7.207 9.021C7.137 9.017 7.071 9 7 9a4 4 0 1 0 0 8h2.167M12 19v-9m0 0-2 2m2-2 2 2"
              />
            </svg>
            <p className="mb-1">
              {dragActive ? (
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  Drop it here
                </span>
              ) : (
                <>
                  <span className="font-semibold text-card-foreground">
                    Click to upload
                  </span>{" "}
                  or drag and drop
                </>
              )}
            </p>
            <p className="text-xs">{hint}</p>
          </div>
          <input
            id={id}
            type="file"
            accept={accept}
            disabled={disabled}
            onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      </div>
      {fileName && (
        <p className="mt-2 text-xs text-muted-foreground">
          Selected: <span className="text-foreground">{fileName}</span>
          {fileSizeLabel ? ` · ${fileSizeLabel}` : ""}
        </p>
      )}
    </div>
  );
}
