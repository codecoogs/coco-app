"use client";

import { Badge } from "@/app/components/ui/shadcn/badge";
import { Button } from "@/app/components/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/shadcn/card";
import { Input } from "@/app/components/ui/shadcn/input";
import { Label } from "@/app/components/ui/shadcn/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/shadcn/table";
import type { FinanceSponsor } from "@/lib/types/finance";
import { useState } from "react";
import { createFinanceSponsor, setFinanceSponsorActive } from "./actions";

type Props = {
  canManageFinances: boolean;
  sponsors: FinanceSponsor[];
  onChange: () => void;
};

export function SponsorsTab({ canManageFinances, sponsors, onChange }: Props) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await createFinanceSponsor({
      name: name.trim(),
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setName("");
    setContactName("");
    setContactEmail("");
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              {canManageFinances && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sponsors.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManageFinances ? 5 : 4} className="text-center text-muted-foreground">
                  No sponsors yet.
                </TableCell>
              </TableRow>
            )}
            {sponsors.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.contact_name ?? "—"}</TableCell>
                <TableCell>{s.contact_email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? "default" : "outline"}>
                    {s.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {canManageFinances && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFinanceSponsorActive(s.id, !s.is_active).then(onChange)}
                    >
                      {s.is_active ? "Deactivate" : "Reactivate"}
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
            <CardTitle>Add sponsor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Contact name</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Contact email</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button onClick={handleAdd} disabled={busy}>
              {busy ? "Adding…" : "Add sponsor"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
