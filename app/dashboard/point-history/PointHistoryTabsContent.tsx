"use client";

import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/shadcn/tabs";
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
        <TabsTrigger value="mine">My Points</TabsTrigger>

        <TabsTrigger value="all_users">Point Information</TabsTrigger>
      </TabsList>
      </Tabs>

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
