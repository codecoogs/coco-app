import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMembershipPlans, getMyMemberships } from "./actions";
import { MembershipSection } from "./MembershipSection";

export default async function MembershipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/membership");
  }

  const [plansRes, membershipsRes] = await Promise.all([
    getMembershipPlans(),
    getMyMemberships(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Memberships</h1>
        <p className="mt-1 text-muted-foreground">
          Join or renew your CodeCoogs membership.
        </p>
      </div>

      <Suspense fallback={null}>
        <MembershipSection
          initialPlans={plansRes.data}
          initialMemberships={membershipsRes.data}
        />
      </Suspense>
    </div>
  );
}
