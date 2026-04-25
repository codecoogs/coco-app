"use client";

import { useProfile } from "@/app/contexts/ProfileContext";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const supabase = useMemo(() => createClient(), []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("avatar_url")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) return;
      const url =
        (data as { avatar_url: string | null } | null)?.avatar_url?.trim() ??
        null;
      setAvatarUrl(url || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [menuOpen]);

  // If auth is still syncing and we have no user yet, show a shell (layout usually passes initialUser).
  if (loading && !user) {
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

  if (!user) {
    return (
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <div className="min-w-0" />
        <nav className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Session unavailable
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

  const positionTitle = profile?.positionTitle?.trim() ?? "";
  const roleName = profile?.roleName?.trim() ?? "";

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {positionTitle && (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: POSITION_BADGE_COLOR }}
          >
            {positionTitle}
          </span>
        )}
        {roleName && (
          <span className="text-xs text-muted-foreground">{roleName}</span>
        )}
      </div>
      <nav className="flex items-center gap-3 sm:gap-4">
        <span className="text-sm text-foreground">
          {showWelcomeBack ? "Welcome back" : "Welcome"}, {displayName}!
        </span>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            <span className="relative h-8 w-8 overflow-hidden rounded-full border border-border bg-muted">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground"
                  aria-hidden
                >
                  {(user.email?.trim()?.[0] ?? "U").toUpperCase()}
                </span>
              )}
            </span>
            <svg
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                menuOpen ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Account menu"
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            >
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-sm font-medium text-card-foreground">
                  {user.email ?? "Account"}
                </p>
                {positionTitle || roleName ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[positionTitle, roleName].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </div>

              <div className="p-1">
                <Link
                  href="/dashboard/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-card-foreground hover:bg-muted"
                >
                  Settings
                </Link>
              </div>

              <div className="border-t border-border p-1">
                <form action="/auth/signout" method="POST">
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center justify-start rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-muted hover:underline dark:text-blue-400"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
