import { getExecutiveDashboardData } from "./actions";
import { ExecutiveDashboardContent } from "./ExecutiveDashboardContent";

/**
 * Rendered by /dashboard/executive, and by /dashboard for users who can see it
 * instead of redirecting there.
 *
 * The redirect is deliberately avoided: a server redirect() during render sets
 * Next's pushRef.mpaNavigation, and app-router's own Router calls five hooks,
 * then throws on that flag, then calls five more. Flipping it mid-render leaves
 * React with a different hook count than the previous render, which throws
 * React #310 from inside Router -- above app/global-error.tsx, so it white-screens
 * the whole document. See vercel/next.js#96680; still present in 16.3.4.
 */
export async function ExecutiveDashboard() {
  const data = await getExecutiveDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Executive dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Member growth, sign-ups, memberships, and form activity.
        </p>
      </div>

      <ExecutiveDashboardContent data={data} />
    </div>
  );
}
