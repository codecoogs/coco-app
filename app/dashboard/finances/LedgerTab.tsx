"use client";

import { Badge } from "@/app/components/ui/shadcn/badge";
import { Button } from "@/app/components/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/shadcn/card";
import { Input } from "@/app/components/ui/shadcn/input";
import { Label } from "@/app/components/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/shadcn/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/shadcn/table";
import { formatCents } from "@/lib/finance/format";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceLedgerSummary,
  FinanceSponsor,
  FinanceTransactionWithLabels,
} from "@/lib/types/finance";
import { useCallback, useMemo, useState } from "react";
import {
  createFinanceCategory,
  deleteManualTransaction,
  getFinanceLedger,
  setFinanceCategoryActive,
  setTransactionVerified,
  type LedgerFilters,
} from "./actions";
import { TransactionFormDialog } from "./TransactionFormDialog";

type Props = {
  canManageFinances: boolean;
  initialLedger: {
    data: FinanceTransactionWithLabels[];
    summary: FinanceLedgerSummary;
    error: string | null;
  };
  categories: FinanceCategory[];
  sponsors: FinanceSponsor[];
  accounts: FinanceAccount[];
  onCategoriesChange: () => void;
};

export function LedgerTab({
  canManageFinances,
  initialLedger,
  categories,
  sponsors,
  accounts,
  onCategoriesChange,
}: Props) {
  const [ledger, setLedger] = useState(initialLedger.data);
  const [summary, setSummary] = useState(initialLedger.summary);
  const [loadError, setLoadError] = useState(initialLedger.error);
  const [filters, setFilters] = useState<LedgerFilters>({});
  const [busy, setBusy] = useState(false);
  const [formDialog, setFormDialog] = useState<
    { mode: "create" } | { mode: "edit"; transaction: FinanceTransactionWithLabels } | null
  >(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"income" | "expense">("expense");

  const refresh = useCallback(async (nextFilters: LedgerFilters) => {
    setBusy(true);
    const res = await getFinanceLedger(nextFilters);
    setLedger(res.data);
    setSummary(res.summary);
    setLoadError(res.error);
    setBusy(false);
  }, []);

  const updateFilter = useCallback(
    (key: keyof LedgerFilters, value: string | undefined) => {
      const next = { ...filters, [key]: value || undefined };
      setFilters(next);
      refresh(next);
    },
    [filters, refresh]
  );

  const activeCategories = useMemo(() => categories.filter((c) => c.is_active), [categories]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this manual transaction? This cannot be undone.")) return;
    const res = await deleteManualTransaction(id);
    if (res.error) {
      alert(res.error);
      return;
    }
    refresh(filters);
  }

  async function handleToggleVerified(t: FinanceTransactionWithLabels) {
    const res = await setTransactionVerified(t.id, t.status !== "verified");
    if (res.error) {
      alert(res.error);
      return;
    }
    refresh(filters);
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    const res = await createFinanceCategory({ name: newCategoryName.trim(), type: newCategoryType });
    if (res.error) {
      alert(res.error);
      return;
    }
    setNewCategoryName("");
    onCategoriesChange();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Income</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCents(summary.total_income_cents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCents(summary.total_expense_cents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Net</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCents(summary.net_cents)}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-direction">Direction</Label>
          <Select
            value={filters.direction ?? "all"}
            onValueChange={(v) => updateFilter("direction", v === "all" ? undefined : (v as string))}
          >
            <SelectTrigger id="filter-direction"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-category">Category</Label>
          <Select
            value={filters.categoryId ?? "all"}
            onValueChange={(v) => updateFilter("categoryId", v === "all" ? undefined : (v as string))}
          >
            <SelectTrigger id="filter-category">
              <SelectValue>
                {(v: string) => (v === "all" ? "All" : activeCategories.find((c) => c.id === v)?.name ?? "All")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {activeCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-status">Status</Label>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(v) => updateFilter("status", v === "all" ? undefined : (v as string))}
          >
            <SelectTrigger id="filter-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unverified">Unverified</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-from">From</Label>
          <Input
            id="filter-from"
            type="date"
            className="w-36"
            onChange={(e) => updateFilter("occurredFrom", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-to">To</Label>
          <Input
            id="filter-to"
            type="date"
            className="w-36"
            onChange={(e) => updateFilter("occurredTo", e.target.value)}
          />
        </div>

        {canManageFinances && (
          <Button className="ml-auto" onClick={() => setFormDialog({ mode: "create" })}>
            Add manual entry
          </Button>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {loadError}
        </div>
      )}

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {canManageFinances && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.length === 0 && !busy && (
              <TableRow>
                <TableCell colSpan={canManageFinances ? 9 : 8} className="text-center text-muted-foreground">
                  No transactions match these filters.
                </TableCell>
              </TableRow>
            )}
            {ledger.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{new Date(t.occurred_at).toLocaleDateString()}</TableCell>
                <TableCell className="max-w-64 truncate">{t.description ?? "—"}</TableCell>
                <TableCell>{t.category_name ?? "Uncategorized"}</TableCell>
                <TableCell>{t.account_name}</TableCell>
                <TableCell>{t.member_name ?? t.sponsor_name ?? "—"}</TableCell>
                <TableCell className="capitalize">{t.source}</TableCell>
                <TableCell>
                  <Badge variant={t.status === "verified" ? "default" : "outline"}>
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right ${t.direction === "expense" ? "text-red-600 dark:text-red-400" : ""}`}>
                  {t.direction === "expense" ? "-" : ""}
                  {formatCents(t.amount_cents, t.currency)}
                </TableCell>
                {canManageFinances && (
                  <TableCell className="text-right whitespace-nowrap">
                    {t.source === "manual" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setFormDialog({ mode: "edit", transaction: t })}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleToggleVerified(t)}>
                      {t.status === "verified" ? "Unverify" : "Verify"}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManageFinances && (
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Badge
                  key={c.id}
                  variant={c.is_active ? "secondary" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFinanceCategoryActive(c.id, !c.is_active).then(onCategoriesChange)}
                  title={c.is_active ? "Click to deactivate" : "Click to reactivate"}
                >
                  {c.name} ({c.type}){!c.is_active && " · inactive"}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="new-category-name">New category</Label>
                <Input
                  id="new-category-name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Event Supplies"
                  className="w-56"
                />
              </div>
              <Select value={newCategoryType} onValueChange={(v) => setNewCategoryType(v as "income" | "expense")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleAddCategory}>Add category</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {formDialog && (
        <TransactionFormDialog
          mode={formDialog.mode}
          transaction={formDialog.mode === "edit" ? formDialog.transaction : undefined}
          categories={activeCategories}
          sponsors={sponsors}
          accounts={accounts}
          onClose={() => setFormDialog(null)}
          onSaved={() => {
            setFormDialog(null);
            refresh(filters);
          }}
        />
      )}
    </div>
  );
}
