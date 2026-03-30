import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { redirect } from "next/navigation";
import { LeaderboardContent } from "./LeaderboardContent";
import { fetchLeaderboardWithMembers } from "./queries";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/leaderboard");
  }

  const [appUserId, lbRes] = await Promise.all([
    getCurrentAppUserId(supabase),
    fetchLeaderboardWithMembers(supabase),
  ]);

  if (lbRes.error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
          <p className="mt-1 text-muted-foreground">
            See how you rank against other members.
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {lbRes.error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
        <p className="mt-1 text-muted-foreground">
          See how you rank against other members.
        </p>
      </div>
      <LeaderboardContent
        initialRows={lbRes.data}
        currentUserId={appUserId}
      />
    </div>
  );
}
