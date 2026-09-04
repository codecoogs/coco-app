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
import type {
  AcademicYear,
  MembershipPlanKind,
  MembershipPlanWithPeriod,
  Semester,
} from "@/lib/types/membership";
import { useState } from "react";
import {
  createMembershipPlan,
  getMembershipPlansForManage,
  setMembershipPlanActive,
  updateMembershipPlan,
} from "./actions";

type Props = {
  initialPlans: MembershipPlanWithPeriod[];
  semesters: Semester[];
  academicYears: AcademicYear[];
};

type FormState = {
  name: string;
  kind: MembershipPlanKind;
  stripe_price_id: string;
  amount: string;
  semester_id: string;
  academic_year_id: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  kind: "semester",
  stripe_price_id: "",
  amount: "",
  semester_id: "",
  academic_year_id: "",
};

function periodOptionLabel(label: string, startDate: string, endDate: string): string {
  return `${label} (${startDate} – ${endDate})`;
}

export function PlansManagementContent({ initialPlans, semesters, academicYears }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; plan: MembershipPlanWithPeriod } | null
  >(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function semesterOptionLabel(id: string): string {
    const s = semesters.find((s) => s.id === id);
    return s ? periodOptionLabel(s.label, s.start_date, s.end_date) : id;
  }

  function academicYearOptionLabel(id: string): string {
    const y = academicYears.find((y) => y.id === id);
    return y ? periodOptionLabel(y.label, y.start_date, y.end_date) : id;
  }

  async function refresh() {
    const res = await getMembershipPlansForManage();
    if (!res.error) setPlans(res.data);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setDialog({ mode: "create" });
  }

  function openEdit(plan: MembershipPlanWithPeriod) {
    setForm({
      name: plan.name,
      kind: plan.kind,
      stripe_price_id: plan.stripe_price_id,
      amount: (plan.amount_cents / 100).toFixed(2),
      semester_id: plan.semester_id ?? "",
      academic_year_id: plan.academic_year_id ?? "",
    });
    setError(null);
    setDialog({ mode: "edit", plan });
  }

  async function handleSave() {
    const amountCents = Math.round(Number(form.amount) * 100);
    const periodId = form.kind === "semester" ? form.semester_id : form.academic_year_id;

    if (!form.name.trim() || !form.stripe_price_id.trim() || !periodId) {
      setError("Fill in all fields, including the period.");
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
      semester_id: form.kind === "semester" ? form.semester_id : null,
      academic_year_id: form.kind === "yearly" ? form.academic_year_id : null,
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
        <Button onClick={openCreate} disabled={semesters.length === 0 && academicYears.length === 0}>
          Add plan
        </Button>
      </div>

      {semesters.length === 0 && academicYears.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No semesters or academic years configured yet - add one in Supabase before creating a plan.
        </p>
      )}

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Period</TableHead>
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
                  <div>{p.period_label}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.starts_at} – {p.ends_at}
                  </div>
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
                    onValueChange={(v) =>
                      v &&
                      setForm((f) => ({
                        ...f,
                        kind: v as MembershipPlanKind,
                        semester_id: "",
                        academic_year_id: "",
                      }))
                    }
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

              {form.kind === "semester" ? (
                <div className="flex flex-col gap-1">
                  <Label>Semester</Label>
                  <Select
                    value={form.semester_id}
                    onValueChange={(v) => v && setForm((f) => ({ ...f, semester_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a semester">
                        {(v: string | null) => (v ? semesterOptionLabel(v) : "Choose a semester")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {semesters.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {periodOptionLabel(s.label, s.start_date, s.end_date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <Label>Academic year</Label>
                  <Select
                    value={form.academic_year_id}
                    onValueChange={(v) => v && setForm((f) => ({ ...f, academic_year_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an academic year">
                        {(v: string | null) => (v ? academicYearOptionLabel(v) : "Choose an academic year")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {periodOptionLabel(y.label, y.start_date, y.end_date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
