"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/shadcn/tabs";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceLedgerSummary,
  FinanceSponsor,
  FinanceTransactionWithLabels,
} from "@/lib/types/finance";
import { useCallback, useState } from "react";
import { getFinanceCategories, getFinanceSponsors, getFinanceAccounts } from "./actions";
import { LedgerTab } from "./LedgerTab";
import { BudgetsTab } from "./BudgetsTab";
import { SponsorsTab } from "./SponsorsTab";
import { AccountsTab } from "./AccountsTab";

type AcademicYear = {
  id: string;
  label: string;
  is_current: boolean;
  start_date: string | null;
  end_date: string | null;
};

type Props = {
  canManageFinances: boolean;
  canManageSources: boolean;
  initialLedger: {
    data: FinanceTransactionWithLabels[];
    summary: FinanceLedgerSummary;
    error: string | null;
  };
  initialCategories: FinanceCategory[];
  initialSponsors: FinanceSponsor[];
  initialAccounts: FinanceAccount[];
  academicYears: AcademicYear[];
};

export function FinancesPageContent({
  canManageFinances,
  canManageSources,
  initialLedger,
  initialCategories,
  initialSponsors,
  initialAccounts,
  academicYears,
}: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [accounts, setAccounts] = useState(initialAccounts);

  const refreshCategories = useCallback(async () => {
    const res = await getFinanceCategories();
    if (!res.error) setCategories(res.data);
  }, []);

  const refreshSponsors = useCallback(async () => {
    const res = await getFinanceSponsors();
    if (!res.error) setSponsors(res.data);
  }, []);

  const refreshAccounts = useCallback(async () => {
    const res = await getFinanceAccounts();
    if (!res.error) setAccounts(res.data);
  }, []);

  return (
    <Tabs defaultValue="ledger">
      <TabsList>
        <TabsTrigger value="ledger">Ledger</TabsTrigger>
        <TabsTrigger value="budgets">Budgets</TabsTrigger>
        <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
        {canManageSources && <TabsTrigger value="accounts">Accounts</TabsTrigger>}
      </TabsList>

      <TabsContent value="ledger" className="mt-4">
        <LedgerTab
          canManageFinances={canManageFinances}
          initialLedger={initialLedger}
          categories={categories}
          sponsors={sponsors}
          accounts={accounts}
          onCategoriesChange={refreshCategories}
        />
      </TabsContent>

      <TabsContent value="budgets" className="mt-4">
        <BudgetsTab
          canManageFinances={canManageFinances}
          academicYears={academicYears}
        />
      </TabsContent>

      <TabsContent value="sponsors" className="mt-4">
        <SponsorsTab
          canManageFinances={canManageFinances}
          sponsors={sponsors}
          onChange={refreshSponsors}
        />
      </TabsContent>

      {canManageSources && (
        <TabsContent value="accounts" className="mt-4">
          <AccountsTab accounts={accounts} onChange={refreshAccounts} />
        </TabsContent>
      )}
    </Tabs>
  );
}
