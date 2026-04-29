import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchPointHistoryForSignedInUser } from "./server-queries";
import { PointHistoryTabsContent } from "./PointHistoryTabsContent";
import { listPointCategories } from "../point-information/actions";

export default async function PointHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/point-history");
  }

  const [{ data, error, hasLinkedProfile }, pointCategoriesRes] =
    await Promise.all([
      fetchPointHistoryForSignedInUser(supabase, {
        id: user.id,
        email: user.email,
      }),
      listPointCategories(),
    ]);

  const myPointsBundle = hasLinkedProfile && !error ? data : null;
  const pointCategories = pointCategoriesRes.data ?? [];
  const pointCategoriesError = pointCategoriesRes.error ?? null;

  return (
    <PointHistoryTabsContent
      pageTitle="My Points"
      myPointsBundle={myPointsBundle}
      myPointsError={hasLinkedProfile ? error : null}
      myPointsMissingProfile={!hasLinkedProfile}
      pointCategories={pointCategories}
      pointCategoriesError={pointCategoriesError}
    />
  );
}
