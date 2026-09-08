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
  const requestedPage =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const [appUserId, requestedRes] = await Promise.all([
    getCurrentAppUserId(supabase),
    fetchLeaderboardWithMembers(supabase, {
      page: requestedPage,
      pageSize: LEADERBOARD_PAGE_SIZE,
    }),
  ]);

  const total = requestedRes.totalCount ?? 0;
  const totalPages =
    total > 0 ? Math.max(1, Math.ceil(total / LEADERBOARD_PAGE_SIZE)) : 1;

  // An out-of-range page is clamped and refetched rather than redirect()ed: a
  // server redirect during a client navigation forces an MPA navigation, and
  // Next's own Router throws React #310 on that flag - above global-error, so
  // it white-screens. See app/dashboard/executive/ExecutiveDashboard.tsx.
  const page =
    requestedRes.error == null && total > 0
      ? Math.min(requestedPage, totalPages)
      : requestedPage;
  const lbRes =
    page === requestedPage
      ? requestedRes
      : await fetchLeaderboardWithMembers(supabase, {
          page,
          pageSize: LEADERBOARD_PAGE_SIZE,
        });

  if (lbRes.error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
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
