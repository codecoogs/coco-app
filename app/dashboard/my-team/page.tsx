import { fetchUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { hasActiveMembership } from "@/lib/supabase/membership";
import { canAccessMemberOnlyFeatures } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { getMyTeamView } from "./actions";
import { MyTeamContent } from "./MyTeamContent";

export default async function MyTeamPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) {
    redirect("/login?next=/dashboard/my-team");
  }

  const [profile, hasMembership] = await Promise.all([
    fetchUserProfile(supabase, authUser.id),
    hasActiveMembership(supabase),
  ]);
  if (!canAccessMemberOnlyFeatures(profile, hasMembership)) {
    redirect("/dashboard");
  }

  const initial = await getMyTeamView();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My team</h1>
      </div>
      <MyTeamContent initial={initial} />
    </div>
  );
}
