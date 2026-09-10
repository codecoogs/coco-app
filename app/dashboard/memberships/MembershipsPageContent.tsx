"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/shadcn/tabs";
import type { PaymentWithUser } from "@/lib/types/membership";
import { AccountsTab } from "./AccountsTab";
import { MembershipsContent } from "./MembershipsContent";
import type { UserPaymentRow } from "./page";
import { PaymentsTab } from "./PaymentsTab";
import type { AuthAccountRow } from "./actions";

type Props = {
  users: UserPaymentRow[];
  initialPayments: PaymentWithUser[];
  paymentsError: string | null;
  accounts: AuthAccountRow[];
  accountsError: string | null;
  /** Member and payment tabs; false for someone who only holds manage_accounts. */
  canManageMemberships: boolean;
  canManageAccounts: boolean;
};

export function MembershipsPageContent({
  users,
  initialPayments,
  paymentsError,
  accounts,
  accountsError,
  canManageMemberships,
  canManageAccounts,
}: Props) {
  return (
    <Tabs defaultValue={canManageMemberships ? "members" : "accounts"}>
      <TabsList>
        {canManageMemberships && (
          <>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </>
        )}
        {canManageAccounts && (
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        )}
      </TabsList>

      {canManageMemberships && (
        <>
          <TabsContent value="members" className="mt-4">
            <MembershipsContent users={users} />
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <PaymentsTab initialPayments={initialPayments} initialError={paymentsError} />
          </TabsContent>
        </>
      )}

      {canManageAccounts && (
        <TabsContent value="accounts" className="mt-4">
          <AccountsTab accounts={accounts} initialError={accountsError} />
        </TabsContent>
      )}
    </Tabs>
  );
}
