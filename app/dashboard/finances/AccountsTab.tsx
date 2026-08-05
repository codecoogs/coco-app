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
import { FINANCE_ACCOUNT_TYPES, type FinanceAccount, type FinanceAccountType } from "@/lib/types/finance";
import { useState } from "react";
import { createFinanceAccount, setFinanceAccountActive } from "./actions";

type Props = {
  accounts: FinanceAccount[];
  onChange: () => void;
};

const TYPE_LABELS: Record<FinanceAccountType, string> = {
  stripe_memberships: "Stripe — Memberships",
  stripe_sponsors: "Stripe — Sponsors",
  tdecu_manual: "TDECU (manual)",
};

export function AccountsTab({ accounts, onChange }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FinanceAccountType>("tdecu_manual");
  const [externalId, setExternalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await createFinanceAccount({
      name: name.trim(),
      type,
      external_id: externalId.trim() || null,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setName("");
    setExternalId("");
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No finance accounts configured yet.
                </TableCell>
              </TableRow>
            )}
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.name}</TableCell>
                <TableCell>{TYPE_LABELS[a.type]}</TableCell>
                <TableCell>{a.external_id ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={a.is_active ? "default" : "outline"}>
                    {a.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFinanceAccountActive(a.id, !a.is_active).then(onChange)}
                  >
                    {a.is_active ? "Deactivate" : "Reactivate"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="TDECU Checking" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as FinanceAccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FINANCE_ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>External ID (optional)</Label>
              <Input
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="Stripe account id"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button onClick={handleAdd} disabled={busy}>
            {busy ? "Adding…" : "Add account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
