"use client";

import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/shadcn/tabs";
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
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
        <TabsTrigger value="teams">Teams</TabsTrigger>
        <TabsTrigger value="leads">Team leads</TabsTrigger>
        <TabsTrigger value="members">Team members</TabsTrigger>
      </TabsList>
      </Tabs>

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
