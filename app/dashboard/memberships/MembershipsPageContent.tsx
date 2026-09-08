"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/shadcn/tabs";
import type { PaymentWithUser } from "@/lib/types/membership";
import { MembershipsContent } from "./MembershipsContent";
import type { UserPaymentRow } from "./page";
import { PaymentsTab } from "./PaymentsTab";

type Props = {
  users: UserPaymentRow[];
  initialPayments: PaymentWithUser[];
  paymentsError: string | null;
};

export function MembershipsPageContent({ users, initialPayments, paymentsError }: Props) {
  return (
    <Tabs defaultValue="members">
      <TabsList>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
      </TabsList>

      <TabsContent value="members" className="mt-4">
        <MembershipsContent users={users} />
      </TabsContent>

      <TabsContent value="payments" className="mt-4">
        <PaymentsTab initialPayments={initialPayments} initialError={paymentsError} />
      </TabsContent>
    </Tabs>
  );
}
