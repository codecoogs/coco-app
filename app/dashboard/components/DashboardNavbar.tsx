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
      <header className="sticky top-0 z-10 flex h-14 items-center justify-end border-b border-zinc-200 bg-white px-4 sm:px-6 dark:border-zinc-700 dark:bg-zinc-900">
        <nav className="flex items-center gap-4">
          <span className="text-sm text-zinc-400 dark:text-zinc-500">
            Loading…
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

  const displayName = user.user_metadata?.full_name ?? user.email ?? "there";
  const showWelcomeBack = isWelcomeBack(
    user.created_at,
    user.last_sign_in_at ?? undefined,
  );

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-end border-b border-zinc-200 bg-white px-4 sm:px-6 dark:border-zinc-700 dark:bg-zinc-900">
      <nav className="flex items-center gap-3 sm:gap-4">
        <div className="flex flex-col items-end sm:flex-row sm:items-center sm:gap-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            {showWelcomeBack ? "Welcome back" : "Welcome"}, {displayName}!
          </span>
          {profile?.positionTitle && (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: POSITION_BADGE_COLOR }}
            >
              {profile.positionTitle}
            </span>
          )}
        </div>
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
