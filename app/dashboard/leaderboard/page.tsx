import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { redirect } from "next/navigation";
import { LeaderboardContent } from "./LeaderboardContent";
import {
  fetchLeaderboardWithMembers,
  LEADERBOARD_PAGE_SIZE,
} from "./queries";

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/leaderboard");
  }

  const sp = await searchParams;
  const parsedPage = parseInt(sp.page ?? "1", 10);
  const page =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const [appUserId, lbRes] = await Promise.all([
    getCurrentAppUserId(supabase),
    fetchLeaderboardWithMembers(supabase, {
      page,
      pageSize: LEADERBOARD_PAGE_SIZE,
    }),
  ]);

  const total = lbRes.totalCount ?? 0;
  const totalPages =
    total > 0 ? Math.max(1, Math.ceil(total / LEADERBOARD_PAGE_SIZE)) : 1;

  if (
    lbRes.error == null &&
    total > 0 &&
    page > totalPages
  ) {
    redirect(
      `/dashboard/leaderboard?page=${totalPages}`
    );
  }

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
        key={page}
        initialRows={lbRes.data}
        currentUserId={appUserId}
        page={page}
        totalCount={lbRes.totalCount}
        pageSize={LEADERBOARD_PAGE_SIZE}
      />
    </div>
  );
}
