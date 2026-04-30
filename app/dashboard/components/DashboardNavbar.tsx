"use client";

import {
  type MemberPublicSnapshot,
  useProfile,
} from "@/app/contexts/ProfileContext";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDashboardShellOptional } from "./DashboardShell";

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

/** Prefer membership names, then auth metadata from signup, then email. */
function welcomeDisplayName(
  user: User,
  member: MemberPublicSnapshot | null,
): string {
  const fromMember = [member?.firstName?.trim(), member?.lastName?.trim()]
    .filter(Boolean)
    .join(" ");
  if (fromMember) return fromMember;

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const mf =
    typeof meta?.first_name === "string" ? meta.first_name.trim() : "";
  const ml =
    typeof meta?.last_name === "string" ? meta.last_name.trim() : "";
  const fromMeta = [mf, ml].filter(Boolean).join(" ");
  if (fromMeta) return fromMeta;

  const full =
    typeof meta?.full_name === "string" ? meta.full_name.trim() : "";
  if (full) return full;

  const email = user.email?.trim();
  if (email) return email;

  return "there";
}

export function DashboardNavbar() {
  const { user, profile, memberPublic, loading } = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const shell = useDashboardShellOptional();

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
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-3 sm:px-6">
        <div className="min-w-0" />
        <nav className="flex items-center gap-3 sm:gap-4">
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
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-3 sm:px-6">
        <div className="min-w-0" />
        <nav className="flex items-center gap-3 sm:gap-4">
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

  const displayName = welcomeDisplayName(user, memberPublic);
  const accountEmail = user.email?.trim() ?? "";
  const menuSubtitleEmail =
    accountEmail && displayName !== accountEmail ? accountEmail : null;
  const showWelcomeBack = isWelcomeBack(
    user.created_at,
    user.last_sign_in_at ?? undefined,
  );

  const positionTitle = profile?.positionTitle?.trim() ?? "";
  const roleName = profile?.roleName?.trim() ?? "";

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => shell?.openMobileSidebar()}
          className="mr-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
          aria-label="Open sidebar"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        {positionTitle ? (
          <span
            className="inline-flex max-w-52 items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium text-white sm:max-w-none sm:px-2.5 sm:text-xs"
            style={{ backgroundColor: POSITION_BADGE_COLOR }}
            title={positionTitle}
          >
            {positionTitle}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground"> </span>
        )}
        {roleName ? (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {roleName}
          </span>
        ) : null}
      </div>

      <nav className="flex items-center gap-2 sm:gap-4">
        {/* Mobile: keep the top bar clean like Discord; put identity text in the menu instead. */}
        <span className="hidden text-sm text-foreground sm:inline">
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
              {memberPublic?.avatarUrl ? (
                <Image
                  src={memberPublic.avatarUrl}
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
                  {displayName}
                </p>
                {menuSubtitleEmail ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {menuSubtitleEmail}
                  </p>
                ) : null}
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
