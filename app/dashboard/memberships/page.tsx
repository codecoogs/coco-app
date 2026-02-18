import type { UserPaymentInfo } from "@/lib/codecoogs-api";
import { MembershipsContent } from "./MembershipsContent";

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Member memberships
        </h1>
        <p className="mt-1 text-slate-600 dark:text-zinc-300">
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
