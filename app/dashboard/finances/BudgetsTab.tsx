"use client";

import { Button } from "@/app/components/ui/shadcn/button";
import { Input } from "@/app/components/ui/shadcn/input";
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
import type { FinanceBudgetWithActual } from "@/lib/types/finance";
import { useEffect, useState, useTransition } from "react";
import { getFinanceBudgets, upsertFinanceBudget } from "./actions";

type AcademicYear = {
  id: string;
  label: string;
  is_current: boolean;
  start_date: string | null;
  end_date: string | null;
};

type Props = {
  canManageFinances: boolean;
  academicYears: AcademicYear[];
};

export function BudgetsTab({ canManageFinances, academicYears }: Props) {
  const [yearId, setYearId] = useState(
    academicYears.find((y) => y.is_current)?.id ?? academicYears[0]?.id ?? ""
  );
  const [budgets, setBudgets] = useState<FinanceBudgetWithActual[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!yearId) return;
    startTransition(async () => {
      const res = await getFinanceBudgets(yearId);
      setBudgets(res.data);
      setError(res.error);
      setDrafts({});
    });
  }, [yearId]);

  const selectedYear = academicYears.find((y) => y.id === yearId);

  async function handleSave(budget: FinanceBudgetWithActual) {
    const raw = drafts[budget.category_id];
    if (raw === undefined) return;
    const plannedCents = Math.round(Number(raw) * 100);
    if (Number.isNaN(plannedCents) || plannedCents < 0) return;

    const res = await upsertFinanceBudget({
      category_id: budget.category_id,
      academic_year_id: yearId,
      planned_amount_cents: plannedCents,
      notes: budget.notes,
    });
    if (res.error) {
      alert(res.error);
      return;
    }
    const refreshed = await getFinanceBudgets(yearId);
    setBudgets(refreshed.data);
    setDrafts((d) => {
      const next = { ...d };
      delete next[budget.category_id];
      return next;
    });
  }

  if (academicYears.length === 0) {
    return <p className="text-muted-foreground">No academic years configured yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={yearId} onValueChange={(v) => v && setYearId(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {academicYears.map((y) => (
              <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!selectedYear?.start_date && (
          <p className="text-sm text-muted-foreground">
            This academic year has no start/end date set, so actuals can&apos;t be calculated.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Planned</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Difference</TableHead>
              {canManageFinances && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && budgets.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManageFinances ? 6 : 5} className="text-center text-muted-foreground">
                  No categories yet — add one from the Ledger tab.
                </TableCell>
              </TableRow>
            )}
            {budgets.map((b) => {
              const draft = drafts[b.category_id];
              const diff = b.planned_amount_cents - b.actual_amount_cents;
              return (
                <TableRow key={b.category_id}>
                  <TableCell>{b.category_name}</TableCell>
                  <TableCell className="capitalize">{b.category_type}</TableCell>
                  <TableCell className="text-right">
                    {canManageFinances ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="ml-auto w-28 text-right"
                        value={draft ?? (b.planned_amount_cents / 100).toFixed(2)}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [b.category_id]: e.target.value }))
                        }
                      />
                    ) : (
                      formatCents(b.planned_amount_cents)
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCents(b.actual_amount_cents)}</TableCell>
                  <TableCell className={`text-right ${diff < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {formatCents(diff)}
                  </TableCell>
                  {canManageFinances && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={draft === undefined}
                        onClick={() => handleSave(b)}
                      >
                        Save
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
