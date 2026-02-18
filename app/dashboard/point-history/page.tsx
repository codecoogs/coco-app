import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PointHistoryContent } from "./PointHistoryContent";

export default async function PointHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login?next=/dashboard/point-history");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Point history</h1>
        <p className="mt-1 text-slate-600">
          View your total points and how they were awarded.
        </p>
      </div>
      <PointHistoryContent email={user.email} />
    </div>
  );
}
