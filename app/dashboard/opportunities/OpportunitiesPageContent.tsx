"use client";

import type { ActiveOpportunity } from "@/lib/types/opportunities";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = {
  opportunities: ActiveOpportunity[];
  locations: string[];
  page: number;
  totalCount: number;
  pageSize: number;
  search: string;
  location: string;
};

function badgeText(o: ActiveOpportunity): string | null {
  return o.employment_type ?? o.category ?? null;
}

function buildHref(pathname: string, params: Record<string, string>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value);
  }
  const qs = usp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function OpportunitiesPageContent({
  opportunities,
  locations,
  page,
  totalCount,
  pageSize,
  search,
  location,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [selected, setSelected] = useState<ActiveOpportunity | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  // Debounce the search box into a URL navigation, which re-runs the server
  // query - keeps search shareable/bookmarkable and consistent with the
  // location dropdown and pagination links below.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === search) return;
    const timeout = setTimeout(() => {
      router.push(buildHref(pathname, { search: trimmed, location, page: "1" }));
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function handleLocationChange(next: string) {
    router.push(buildHref(pathname, { search, location: next, page: "1" }));
  }

  const filterOptions = useMemo(() => {
    const values = opportunities
      .map(badgeText)
      .filter((v): v is string => Boolean(v));
    return [...new Set(values)].sort();
  }, [opportunities]);

  const visible = useMemo(
    () => (typeFilter ? opportunities.filter((o) => badgeText(o) === typeFilter) : opportunities),
    [opportunities, typeFilter]
  );

  const totalPages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
  const hasActiveSearch = Boolean(search || location);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by title…"
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-xs"
        />
        <select
          value={location}
          onChange={(e) => handleLocationChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto"
        >
          <option value="">All locations</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
        {hasActiveSearch && (
          <Link
            href={pathname}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Clear filters
          </Link>
        )}
      </div>

      {!opportunities.length ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-muted-foreground">
            {hasActiveSearch
              ? "No opportunities match your search."
              : "No opportunities are open right now — check back soon."}
          </p>
        </section>
      ) : (
        <>
          {filterOptions.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTypeFilter(null)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  typeFilter === null
                    ? "bg-blue-600 text-white"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                All
              </button>
              {filterOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setTypeFilter(opt)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    typeFilter === opt
                      ? "bg-blue-600 text-white"
                      : "border border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {!visible.length ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No opportunities match this filter.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((o) => {
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
          )}

          {totalCount > pageSize && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <nav
                className="flex flex-wrap items-center gap-2"
                aria-label="Opportunities pagination"
              >
                <Link
                  href={buildHref(pathname, {
                    search,
                    location,
                    page: String(Math.max(1, page - 1)),
                  })}
                  aria-disabled={page <= 1}
                  className={
                    page <= 1
                      ? "pointer-events-none rounded-lg border border-border px-3 py-2 text-sm font-medium opacity-40"
                      : "rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
                  }
                >
                  Previous
                </Link>
                <Link
                  href={buildHref(pathname, { search, location, page: String(page + 1) })}
                  aria-disabled={page >= totalPages}
                  className={
                    page >= totalPages
                      ? "pointer-events-none rounded-lg border border-border px-3 py-2 text-sm font-medium opacity-40"
                      : "rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
                  }
                >
                  Next
                </Link>
              </nav>
            </div>
          )}
        </>
      )}

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

            {selected.linked_form_id ? (
              <Link
                href={`/dashboard/forms/${selected.linked_form_id}`}
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Apply
              </Link>
            ) : (
              <a
                href={selected.link_url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Apply / Learn more
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
