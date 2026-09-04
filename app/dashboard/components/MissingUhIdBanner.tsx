"use client";

import { useProfile } from "@/app/contexts/ProfileContext";
import { isTeamAllowed } from "@/lib/types/rbac";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Prompts non-officer members whose public.users.uh_id is still empty to
 * fill it in — required for CSI (Center of Student Involvement) org
 * rostering. Officers are exempt here (handled separately); disappears on
 * its own once the field is set, and doesn't show on the settings page
 * itself since the user is already looking at the field there.
 */
export function MissingUhIdBanner() {
  const { loading, memberPublic, profile } = useProfile();
  const pathname = usePathname();

  if (loading || !memberPublic) return null;
  if (memberPublic.uhId) return null;
  if (isTeamAllowed(profile)) return null;
  if (pathname === "/dashboard/settings") return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 sm:px-6">
      <p>
        Please add your UH ID in{" "}
        <Link href="/dashboard/settings" className="font-medium underline underline-offset-2">
          Settings
        </Link>{" "}
        — required for CSI org rostering.
      </p>
    </div>
  );
}
