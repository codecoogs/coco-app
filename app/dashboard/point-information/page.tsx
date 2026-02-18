import { getPointCategories } from "@/lib/codecoogs-api";

export default async function PointInformationPage() {
  let categories: Awaited<
    ReturnType<typeof getPointCategories>
  >["point_categories"] = [];
  let error: string | null = null;

  try {
    const res = await getPointCategories();
    if (res.success && res.point_categories) {
      categories = res.point_categories;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load point categories.";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Point information
        </h1>
        <p className="mt-1 text-muted-foreground">
          Point values by category. Use this to see how many points each
          activity is worth.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-card-foreground">
              Point categories
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {categories.length} categor{categories.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Category
                  </th>
                  <th className="bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Description
                  </th>
                  <th className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {categories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-muted-foreground sm:px-6"
                    >
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-muted">
                      <td className="px-4 py-3 text-sm font-medium text-card-foreground sm:px-6">
                        {cat.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground sm:px-6">
                        {cat.description || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-card-foreground sm:px-6">
                        {cat.points_value} pts
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
