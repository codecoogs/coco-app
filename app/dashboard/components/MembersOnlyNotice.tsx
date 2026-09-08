import Link from "next/link";

/**
 * Shown in place of a member-only feature for signed-in users without an active
 * membership. These pages used to redirect to /dashboard, which told the user
 * nothing about why and silently dropped them somewhere else - and every such
 * redirect is a chance to trip the app-router hook bug that shows a white
 * screen. Rendering in place is both clearer and safer.
 */
export function MembersOnlyNotice({ feature }: { feature: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-card-foreground">
        {feature} is for members
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        This feature is reserved for CodeCoogs members. Become a member to unlock
        it along with the rest of the member-only dashboard.
      </p>
      <Link
        href="/dashboard/membership"
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
      >
        Become a member
      </Link>
    </div>
  );
}
