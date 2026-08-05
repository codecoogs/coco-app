"use client";

import { Badge } from "@/app/components/ui/shadcn/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/shadcn/table";
import { formatCents } from "@/lib/finance/format";
import type { MembershipPlan, MembershipPlanKind } from "@/lib/types/membership";
import { useState } from "react";
import {
  createMembershipPlan,
  getMembershipPlansForManage,
  setMembershipPlanActive,
  updateMembershipPlan,
} from "./actions";

type Props = {
  initialPlans: MembershipPlan[];
};

type FormState = {
  name: string;
  kind: MembershipPlanKind;
  stripe_price_id: string;
  amount: string;
  starts_at: string;
  ends_at: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  kind: "semester",
  stripe_price_id: "",
  amount: "",
  starts_at: "",
  ends_at: "",
};

export function PlansManagementContent({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; plan: MembershipPlan } | null>(
    null
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await getMembershipPlansForManage();
    if (!res.error) setPlans(res.data);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setDialog({ mode: "create" });
  }

  function openEdit(plan: MembershipPlan) {
    setForm({
      name: plan.name,
      kind: plan.kind,
      stripe_price_id: plan.stripe_price_id,
      amount: (plan.amount_cents / 100).toFixed(2),
      starts_at: plan.starts_at,
      ends_at: plan.ends_at,
    });
    setError(null);
    setDialog({ mode: "edit", plan });
  }

  async function handleSave() {
    const amountCents = Math.round(Number(form.amount) * 100);
    if (!form.name.trim() || !form.stripe_price_id.trim() || !form.starts_at || !form.ends_at) {
      setError("Fill in all fields.");
      return;
    }
    if (!amountCents || amountCents <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setBusy(true);
    setError(null);

    const input = {
      name: form.name.trim(),
      kind: form.kind,
      stripe_price_id: form.stripe_price_id.trim(),
      amount_cents: amountCents,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
    };

    const res =
      dialog?.mode === "edit"
        ? await updateMembershipPlan(dialog.plan.id, input)
        : await createMembershipPlan(input);

    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDialog(null);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>Add plan</Button>
      </div>

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No membership plans yet.
                </TableCell>
              </TableRow>
            )}
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell className="capitalize">{p.kind}</TableCell>
                <TableCell>{formatCents(p.amount_cents)}</TableCell>
                <TableCell>
                  {p.starts_at} – {p.ends_at}
                </TableCell>
                <TableCell>
                  <Badge variant={p.is_active ? "default" : "outline"}>
                    {p.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMembershipPlanActive(p.id, !p.is_active).then(refresh)}
                  >
                    {p.is_active ? "Deactivate" : "Reactivate"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {dialog && (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{dialog.mode === "edit" ? "Edit plan" : "Add plan"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Fall 2026 Semester"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label>Kind</Label>
                  <Select
                    value={form.kind}
                    onValueChange={(v) => v && setForm((f) => ({ ...f, kind: v as MembershipPlanKind }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semester">Semester</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Label>Stripe Price ID</Label>
                <Input
                  value={form.stripe_price_id}
                  onChange={(e) => setForm((f) => ({ ...f, stripe_price_id: e.target.value }))}
                  placeholder="price_..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label>Starts</Label>
                  <Input
                    type="date"
                    value={form.starts_at}
                    onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Ends</Label>
                  <Input
                    type="date"
                    value={form.ends_at}
                    onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
