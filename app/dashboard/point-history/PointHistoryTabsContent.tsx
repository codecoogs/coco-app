"use client";

import { useState } from "react";
import type { PointHistoryBundle } from "./queries";
import { PointHistoryContent } from "./PointHistoryContent";
import { PointInformationContent } from "../point-information/PointInformationContent";
import type { PointCategoryRow } from "../point-information/actions";

type Props = {
  pageTitle: string;
  myPointsBundle: PointHistoryBundle | null;
  myPointsError: string | null;
  myPointsMissingProfile: boolean;
  pointCategories: PointCategoryRow[];
  pointCategoriesError: string | null;
};

type TabKey = "mine" | "all_users";

export function PointHistoryTabsContent({
  pageTitle,
  myPointsBundle,
  myPointsError,
  myPointsMissingProfile,
  pointCategories,
  pointCategoriesError,
}: Props) {
  const [tab, setTab] = useState<TabKey>("mine");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
      </div>

      <div
        className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
        role="tablist"
        aria-label="Point views"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mine"}
          onClick={() => setTab("mine")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "mine"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          My Points
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === "all_users"}
          onClick={() => setTab("all_users")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "all_users"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Point Infomation
        </button>
      </div>

      {tab === "mine" ? (
        myPointsMissingProfile ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            We could not match your login to a member profile (by account link
            or email). After signing up, your profile should appear here. If you
            expect to see points, contact an officer to verify your email
            matches your membership record.
          </div>
        ) : myPointsError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {myPointsError}
          </div>
        ) : myPointsBundle ? (
          <PointHistoryContent initial={myPointsBundle} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading your point history…
          </div>
        )
      ) : pointCategoriesError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {pointCategoriesError}
        </div>
      ) : (
        <PointInformationContent
          initialCategories={pointCategories}
          canManage={false}
        />
      )}
    </div>
  );
}
