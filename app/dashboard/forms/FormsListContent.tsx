"use client";

import Link from "next/link";
import type { RespondentFormListItem } from "./actions";

type Props = { forms: RespondentFormListItem[] };

export function FormsListContent({ forms }: Props) {
  if (!forms.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No forms are open for you right now.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {forms.map((f) => (
        <Link
          key={f.id}
          href={`/dashboard/forms/${f.id}`}
          className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:bg-muted"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold text-card-foreground">{f.title}</h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                f.has_responded
                  ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {f.has_responded ? "Submitted" : "Not started"}
            </span>
          </div>
          {f.description && (
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
              {f.description}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
