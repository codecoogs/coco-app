import type { UserPaymentInfo } from "@/lib/codecoogs-api";
import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { MembershipsContent } from "./MembershipsContent";
import { redirect } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_CODECOOGS_API_URL ?? "https://api.codecoogs.com/v1";
const CACHE_REVALIDATE_SECONDS = 60;

async function fetchUsersPaymentInfo(): Promise<UserPaymentInfo[]> {
  const url = `${API_BASE}/users?payment_info=true`;
  const res = await fetch(url, {
    next: { revalidate: CACHE_REVALIDATE_SECONDS },
    headers: { Accept: "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  if (!data.success || !Array.isArray(data.users_payment_info))
    return [];
  return data.users_payment_info;
}

export default async function MembershipsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/memberships");
  }

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, "manage_memberships")) {
    redirect("/dashboard");
  }

  let users: UserPaymentInfo[] = [];
  let error: string | null = null;

  try {
    users = await fetchUsersPaymentInfo();
  } catch (e) {
    error =
      e instanceof Error ? e.message : "Failed to load users with payment info.";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Member memberships
        </h1>
        <p className="mt-1 text-muted-foreground">
          View all users with payment and due date info. Filter by active
          membership, paid status, and membership type. For officers and admins.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : (
        <MembershipsContent users={users} />
      )}
    </div>
  );
}
