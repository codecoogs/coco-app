import { createClient } from "@/lib/supabase/server";
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

  const initial = await getMyTeamView();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My team</h1>
        <p className="mt-1 text-muted-foreground">
          View your team details and manage your team if you are a lead.
        </p>
      </div>
      <MyTeamContent initial={initial} />
    </div>
  );
}
