"use client";

import { Badge } from "@/app/components/ui/shadcn/badge";
import { Button } from "@/app/components/ui/shadcn/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/shadcn/card";
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
import {
  getFinanceCategories,
  getFinanceSponsors,
  getFinanceAccounts,
  setFinanceCategoryActive,
} from "./actions";
import { CategoryFormDialog } from "./CategoryFormDialog";
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
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

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
    <div className="space-y-6">
      {canManageFinances && (
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardAction>
              <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
                Add category
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Badge
                  key={c.id}
                  variant={c.is_active ? "secondary" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFinanceCategoryActive(c.id, !c.is_active).then(refreshCategories)}
                  title={c.is_active ? "Click to deactivate" : "Click to reactivate"}
                >
                  {c.name} ({c.type}){!c.is_active && " · inactive"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      {categoryDialogOpen && (
        <CategoryFormDialog
          onClose={() => setCategoryDialogOpen(false)}
          onSaved={() => {
            setCategoryDialogOpen(false);
            refreshCategories();
          }}
        />
      )}
    </div>
  );
}
