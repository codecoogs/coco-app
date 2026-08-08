import { createClient } from "@/lib/supabase/server";
import { OPPORTUNITIES_PAGE_SIZE } from "@/lib/types/opportunities";
import { redirect } from "next/navigation";
import { getActiveOpportunities, getOpportunityLocations } from "./actions";
import { OpportunitiesPageContent } from "./OpportunitiesPageContent";

type PageProps = {
  searchParams: Promise<{ page?: string; search?: string; location?: string }>;
};

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect("/login?next=/dashboard/opportunities");
  }

  const sp = await searchParams;
  const parsedPage = parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const search = sp.search?.trim() ?? "";
  const location = sp.location?.trim() ?? "";

  const [oppsRes, locationsRes] = await Promise.all([
    getActiveOpportunities({ page, pageSize: OPPORTUNITIES_PAGE_SIZE, search, location }),
    getOpportunityLocations(),
  ]);

  const totalPages =
    oppsRes.totalCount > 0 ? Math.max(1, Math.ceil(oppsRes.totalCount / OPPORTUNITIES_PAGE_SIZE)) : 1;

  if (oppsRes.error == null && oppsRes.totalCount > 0 && page > totalPages) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (location) params.set("location", location);
    params.set("page", String(totalPages));
    redirect(`/dashboard/opportunities?${params.toString()}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Opportunities</h1>
        <p className="mt-1 text-muted-foreground">
          Jobs, internships, and ways to get involved.
        </p>
      </div>

      {oppsRes.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {oppsRes.error}
        </div>
      ) : (
        <OpportunitiesPageContent
          key={`${page}|${search}|${location}`}
          opportunities={oppsRes.data}
          locations={locationsRes.data}
          page={page}
          totalCount={oppsRes.totalCount}
          pageSize={OPPORTUNITIES_PAGE_SIZE}
          search={search}
          location={location}
        />
      )}
    </div>
  );
}
