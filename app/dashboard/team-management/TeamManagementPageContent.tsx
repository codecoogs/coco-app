"use client";

import { useState } from "react";
import type {
  AcademicYearOption,
  TeamLeadManageRow,
  TeamManageRow,
  TeamMemberRow,
} from "./actions";
import { TeamLeadsContent } from "./TeamLeadsContent";
import type { TeamOption } from "./TeamLeadsContent";
import { TeamMembersContent } from "./TeamMembersContent";
import { TeamsContent } from "./TeamsContent";

type Props = {
  initialTab: "teams" | "leads" | "members";
  initialTeams: TeamManageRow[];
  academicYears: AcademicYearOption[];
  loadErrorTeams: string | null;
  loadErrorYears: string | null;
  initialLeads: TeamLeadManageRow[];
  teamsForLeads: TeamOption[];
  loadErrorLeads: string | null;
  initialMembers: TeamMemberRow[];
  loadErrorMembers: string | null;
  canManage: boolean;
};

export function TeamManagementPageContent({
  initialTab,
  initialTeams,
  academicYears,
  loadErrorTeams,
  loadErrorYears,
  initialLeads,
  teamsForLeads,
  loadErrorLeads,
  initialMembers,
  loadErrorMembers,
  canManage,
}: Props) {
  const [tab, setTab] = useState<"teams" | "leads" | "members">(initialTab);

  return (
    <div className="space-y-6">
      <div
        className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
        role="tablist"
        aria-label="Team management sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "teams"}
          onClick={() => setTab("teams")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "teams"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Teams
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "leads"}
          onClick={() => setTab("leads")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "leads"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Team leads
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "members"}
          onClick={() => setTab("members")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "members"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Team members
        </button>
      </div>

      {tab === "teams" ? (
        <TeamsContent
          initialTeams={initialTeams}
          academicYears={academicYears}
          loadErrorTeams={loadErrorTeams}
          loadErrorYears={loadErrorYears}
          canManage={canManage}
        />
      ) : tab === "leads" ? (
        <TeamLeadsContent
          initialLeads={initialLeads}
          teams={teamsForLeads}
          loadErrorLeads={loadErrorLeads}
          canManage={canManage}
        />
      ) : (
        <TeamMembersContent
          initialMembers={initialMembers}
          teams={teamsForLeads}
          loadErrorMembers={loadErrorMembers}
          canManage={canManage}
        />
      )}
    </div>
  );
}
