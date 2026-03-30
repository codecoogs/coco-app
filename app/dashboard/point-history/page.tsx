import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchPointHistoryForSignedInUser } from "./server-queries";
import { PointHistoryContent } from "./PointHistoryContent";

export default async function PointHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/point-history");
  }

  const { data, error, hasLinkedProfile } = await fetchPointHistoryForSignedInUser(
    supabase,
    {
      id: user.id,
      email: user.email,
    }
  );

  if (!hasLinkedProfile) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Point history</h1>
          <p className="mt-1 text-muted-foreground">
            View your total points and how they were awarded.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          We could not match your login to a member profile (by account link or email).
          After signing up, your profile should appear here. If you expect to see points,
          contact an officer to verify your email matches your membership record.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Point history</h1>
          <p className="mt-1 text-muted-foreground">
            View your total points and how they were awarded.
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Point history</h1>
        <p className="mt-1 text-muted-foreground">
          View your total points and how they were awarded.
        </p>
      </div>
      <PointHistoryContent initial={data} />
    </div>
  );
}
