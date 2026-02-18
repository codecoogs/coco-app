"use client";

import { useProfile } from "@/app/contexts/ProfileContext";

const POSITION_BADGE_COLOR = "#04495d";

/** Consider "welcome back" if last sign-in is at least this many ms after account creation. */
const WELCOME_BACK_THRESHOLD_MS = 60 * 1000;

function isWelcomeBack(
  createdAt: string,
  lastSignInAt: string | undefined,
): boolean {
  if (!lastSignInAt) return false;
  const created = new Date(createdAt).getTime();
  const last = new Date(lastSignInAt).getTime();
  return last - created >= WELCOME_BACK_THRESHOLD_MS;
}

export function DashboardNavbar() {
  const { user, profile, loading } = useProfile();

  if (!user) return null;
  if (loading) {
    return (
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <div className="min-w-0" />
        <nav className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Loading…</span>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>
    );
  }

  const displayName = user.user_metadata?.full_name ?? user.email ?? "there";
  const showWelcomeBack = isWelcomeBack(
    user.created_at,
    user.last_sign_in_at ?? undefined,
  );

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex min-w-0 items-center">
        {profile?.positionTitle && (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: POSITION_BADGE_COLOR }}
          >
            {profile.positionTitle}
          </span>
        )}
      </div>
      <nav className="flex items-center gap-3 sm:gap-4">
        <span className="text-sm text-foreground">
          {showWelcomeBack ? "Welcome back" : "Welcome"}, {displayName}!
        </span>
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
