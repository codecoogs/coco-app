import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveOpportunities } from "./actions";
import { OpportunitiesPageContent } from "./OpportunitiesPageContent";

export default async function OpportunitiesPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect("/login?next=/dashboard/opportunities");
  }

  const { data, error } = await getActiveOpportunities();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Opportunities</h1>
        <p className="mt-1 text-muted-foreground">
          Jobs, internships, and ways to get involved.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : (
        <OpportunitiesPageContent opportunities={data} />
      )}
    </div>
  );
}
