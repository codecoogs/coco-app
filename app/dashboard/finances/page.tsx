import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasAnyPermission, hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import {
  getAcademicYears,
  getFinanceAccounts,
  getFinanceCategories,
  getFinanceLedger,
  getFinanceSponsors,
} from "./actions";
import { FinancesPageContent } from "./FinancesPageContent";

export default async function FinancesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/finances");
  }

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasAnyPermission(profile, ["view_finances", "manage_finances", "manage_finance_sources"])) {
    redirect("/dashboard");
  }

  const canManageFinances = hasPermission(profile, "manage_finances");
  const canManageSources = hasPermission(profile, "manage_finance_sources");

  const [ledgerRes, categoriesRes, sponsorsRes, accountsRes, yearsRes] = await Promise.all([
    getFinanceLedger(),
    getFinanceCategories(),
    getFinanceSponsors(),
    getFinanceAccounts(),
    getAcademicYears(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finances</h1>
        <p className="mt-1 text-muted-foreground">
          Income, expenses, budgets, and payment sources.
        </p>
      </div>

      <FinancesPageContent
        canManageFinances={canManageFinances}
        canManageSources={canManageSources}
        initialLedger={ledgerRes}
        initialCategories={categoriesRes.data}
        initialSponsors={sponsorsRes.data}
        initialAccounts={accountsRes.data}
        academicYears={yearsRes.data}
      />
    </div>
  );
}
