import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasAnyPermission, hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import {
  getAcademicYearsForSelect,
  getTeamLeadsForManage,
  getTeamMembersForManage,
  getTeamsForManage,
} from "./actions";
import { TeamManagementPageContent } from "./TeamManagementPageContent";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function TeamManagementPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect("/login?next=/dashboard/team-management");
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasAnyPermission(profile, ["manage_officers", "manage_teams"])) {
    redirect("/dashboard");
  }

  const canManage =
    hasPermission(profile, "manage_officers") || hasPermission(profile, "manage_teams");

  const sp = await searchParams;
  const tab = sp.tab;
  const initialTab: "teams" | "leads" | "members" =
    tab === "leads" ? "leads" : tab === "members" ? "members" : "teams";

  const [teamsRes, yearsRes, leadsRes, membersRes] = await Promise.all([
    getTeamsForManage(),
    getAcademicYearsForSelect(),
    getTeamLeadsForManage(),
    getTeamMembersForManage(),
  ]);

  const teamOptions = teamsRes.data.map((t) => ({ id: t.id, name: t.name }));
  const loadCombinedLeads =
    [teamsRes.error, leadsRes.error].filter(Boolean).join("; ") || null;
  const loadErrorMembers = membersRes.error;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Team management</h1>
        <p className="mt-1 text-muted-foreground">
          Manage chapter teams (name, number, academic year), team roster members, and one lead per
          team. Requires officer view permission; roster and lead edits require manage officers.
        </p>
      </div>

      <TeamManagementPageContent
        key={initialTab}
        initialTab={initialTab}
        initialTeams={teamsRes.data}
        academicYears={yearsRes.data}
        loadErrorTeams={teamsRes.error}
        loadErrorYears={yearsRes.error}
        initialLeads={leadsRes.data}
        teamsForLeads={teamOptions}
        loadErrorLeads={loadCombinedLeads}
        initialMembers={membersRes.data}
        loadErrorMembers={loadErrorMembers}
        canManage={canManage}
      />
    </div>
  );
}
