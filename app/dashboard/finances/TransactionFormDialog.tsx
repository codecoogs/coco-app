"use client";

import { Button } from "@/app/components/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/shadcn/dialog";
import { Input } from "@/app/components/ui/shadcn/input";
import { Label } from "@/app/components/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/shadcn/select";
import { Textarea } from "@/app/components/ui/shadcn/textarea";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceDirection,
  FinanceSponsor,
  FinanceTransactionInput,
  FinanceTransactionWithLabels,
} from "@/lib/types/finance";
import { useState } from "react";
import { createManualTransaction, updateManualTransaction } from "./actions";

type Props = {
  mode: "create" | "edit";
  transaction?: FinanceTransactionWithLabels;
  categories: FinanceCategory[];
  sponsors: FinanceSponsor[];
  accounts: FinanceAccount[];
  onClose: () => void;
  onSaved: () => void;
};

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

export function TransactionFormDialog({
  mode,
  transaction,
  categories,
  sponsors,
  accounts,
  onClose,
  onSaved,
}: Props) {
  const [direction, setDirection] = useState<FinanceDirection>(transaction?.direction ?? "expense");
  const [accountId, setAccountId] = useState(
    transaction?.account_id ?? accounts.find((a) => a.type === "tdecu_manual")?.id ?? accounts[0]?.id ?? ""
  );
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [sponsorId, setSponsorId] = useState(transaction?.sponsor_id ?? "");
  const [amount, setAmount] = useState(transaction ? (transaction.amount_cents / 100).toFixed(2) : "");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [occurredAt, setOccurredAt] = useState(
    transaction ? toDateInputValue(transaction.occurred_at) : toDateInputValue(new Date().toISOString())
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const relevantCategories = categories.filter((c) => c.type === direction);

  async function handleSubmit() {
    const amountCents = Math.round(Number(amount) * 100);
    if (!accountId) {
      setError("Choose an account.");
      return;
    }
    if (!amountCents || amountCents <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setBusy(true);
    setError(null);

    const input: FinanceTransactionInput = {
      account_id: accountId,
      category_id: categoryId || null,
      direction,
      amount_cents: amountCents,
      description: description.trim() || null,
      occurred_at: new Date(occurredAt).toISOString(),
      member_id: null,
      sponsor_id: sponsorId || null,
    };

    const res =
      mode === "edit" && transaction
        ? await updateManualTransaction(transaction.id, input)
        : await createManualTransaction(input);

    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit transaction" : "Add manual entry"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(v) => { setDirection(v as FinanceDirection); setCategoryId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Category</Label>
            <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : (v as string))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {relevantCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {direction === "income" && (
            <div className="flex flex-col gap-1">
              <Label>Sponsor (optional)</Label>
              <Select value={sponsorId || "none"} onValueChange={(v) => setSponsorId(v === "none" ? "" : (v as string))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sponsors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label>Date</Label>
            <Input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
