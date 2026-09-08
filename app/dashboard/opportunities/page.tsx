import { MembersOnlyNotice } from "@/app/dashboard/components/MembersOnlyNotice";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { hasActiveMembership } from "@/lib/supabase/membership";
import { OPPORTUNITIES_PAGE_SIZE } from "@/lib/types/opportunities";
import { canAccessMemberOnlyFeatures } from "@/lib/types/rbac";
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

  const [profile, hasMembership] = await Promise.all([
    fetchUserProfile(supabase, authUser.id),
    hasActiveMembership(supabase),
  ]);
  if (!canAccessMemberOnlyFeatures(profile, hasMembership)) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-foreground">Opportunities</h1>
        <MembersOnlyNotice feature="Opportunities" />
      </div>
    );
  }

  const sp = await searchParams;
  const parsedPage = parseInt(sp.page ?? "1", 10);
  const requestedPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const search = sp.search?.trim() ?? "";
  const location = sp.location?.trim() ?? "";

  const [requestedRes, locationsRes] = await Promise.all([
    getActiveOpportunities({ page: requestedPage, pageSize: OPPORTUNITIES_PAGE_SIZE, search, location }),
    getOpportunityLocations(),
  ]);

  const totalPages =
    requestedRes.totalCount > 0 ? Math.max(1, Math.ceil(requestedRes.totalCount / OPPORTUNITIES_PAGE_SIZE)) : 1;

  // An out-of-range page is clamped and refetched rather than redirect()ed: a
  // server redirect during a client navigation forces an MPA navigation, and
  // Next's own Router throws React #310 on that flag - above global-error, so
  // it white-screens. See app/dashboard/executive/ExecutiveDashboard.tsx.
  const page =
    requestedRes.error == null && requestedRes.totalCount > 0
      ? Math.min(requestedPage, totalPages)
      : requestedPage;
  const oppsRes =
    page === requestedPage
      ? requestedRes
      : await getActiveOpportunities({ page, pageSize: OPPORTUNITIES_PAGE_SIZE, search, location });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Opportunities</h1>
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
