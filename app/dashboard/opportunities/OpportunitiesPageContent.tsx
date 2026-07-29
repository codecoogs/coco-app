"use client";

import type { ActiveOpportunity } from "@/lib/types/opportunities";
import { useState } from "react";

type Props = {
  opportunities: ActiveOpportunity[];
};

function badgeText(o: ActiveOpportunity): string | null {
  return o.employment_type ?? o.category ?? null;
}

export function OpportunitiesPageContent({ opportunities }: Props) {
  const [selected, setSelected] = useState<ActiveOpportunity | null>(null);

  if (!opportunities.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-muted-foreground">
          No opportunities are open right now — check back soon.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {opportunities.map((o) => {
          const badge = badgeText(o);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelected(o)}
              className="flex flex-col items-start rounded-xl border border-border bg-card p-5 text-left shadow-sm transition hover:bg-muted"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <h2 className="font-semibold text-card-foreground">{o.title}</h2>
                {badge && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {badge}
                  </span>
                )}
              </div>
              {o.company_name && (
                <p className="mt-1 text-sm font-medium text-foreground">
                  {o.company_name}
                </p>
              )}
              {o.location && (
                <p className="mt-0.5 text-xs text-muted-foreground">{o.location}</p>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="opportunity-detail-title"
          onClick={() => setSelected(null)}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") setSelected(null);
          }}
        >
          <div
            className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="self-end text-sm text-muted-foreground hover:text-foreground"
            >
              Close
            </button>

            <div className="mt-2 flex items-start justify-between gap-2">
              <h2
                id="opportunity-detail-title"
                className="text-xl font-bold text-card-foreground"
              >
                {selected.title}
              </h2>
              {badgeText(selected) && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {badgeText(selected)}
                </span>
              )}
            </div>

            {selected.company_name && (
              <p className="mt-1 font-medium text-foreground">{selected.company_name}</p>
            )}
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[selected.location, selected.salary].filter(Boolean).join(" · ")}
            </p>

            {selected.description && (
              <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
                {selected.description}
              </p>
            )}

            <a
              href={selected.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Apply / Learn more
            </a>
          </div>
        </div>
      )}
    </>
  );
}
