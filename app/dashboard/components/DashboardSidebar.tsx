"use client";

import { useProfileOptional } from "@/app/contexts/ProfileContext";
import { useThemeOptional } from "@/app/contexts/ThemeContext";
import { hasAnyPermission, type PermissionName } from "@/lib/types/rbac";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useDashboardShellOptional } from "./DashboardShell";

type NavItem = {
  href: string;
  label: string;
  /** If set, sidebar link is only shown when user has this permission (or is_admin). */
  requiredPermission?: PermissionName;
  /** If set, shown when user has any of these permissions (or is_admin). */
  requiredAnyPermissions?: readonly PermissionName[];
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/point-history",
    label: "My Points",
    icon: (
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/leaderboard",
    label: "Leaderboard",
    icon: (
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/events",
    label: "Events",
    icon: (
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/opportunities",
    label: "Opportunities",
    icon: (
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/teams",
    label: "Teams",
    icon: (
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20h10M12 12a4 4 0 100-8 4 4 0 000 8z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/my-team",
    label: "My team",
    icon: (
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V7a2 2 0 00-2-2h-3V3H10v2H7a2 2 0 00-2 2v14m14 0H5m14 0h2M5 21H3m6-6h6"
        />
      </svg>
    ),
  },
];

/** Root `/dashboard` must not use prefix matching, or every child route (e.g. `/dashboard/point-history`) looks active too. */
function isMainNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ThemeIcon({
  theme,
}: {
  theme:
    | "light"
    | "dark"
    | "system"
    | "latte"
    | "pink-sorbet"
    | "frappe"
    | "macchiato"
    | "mocha";
}) {
  if (theme === "system") {
    return (
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    );
  }
  if (theme === "light" || theme === "latte" || theme === "pink-sorbet") {
    return (
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [managementOpen, setManagementOpen] = useState(
    () =>
      pathname.startsWith("/dashboard/events/manage") ||
      pathname.startsWith("/dashboard/officers") ||
      pathname.startsWith("/dashboard/permissions") ||
      pathname.startsWith("/dashboard/memberships") ||
      pathname.startsWith("/dashboard/team-management") ||
      pathname.startsWith("/dashboard/ticket-management") ||
      pathname.startsWith("/dashboard/point-management")
  );
  const [otherOpen, setOtherOpen] = useState(false);
  const themeContext = useThemeOptional();
  const profileContext = useProfileOptional();
  const can = profileContext?.can ?? (() => false);
  const profile = profileContext?.profile ?? null;
  const shell = useDashboardShellOptional();
  const mobileOpen = shell?.mobileSidebarOpen ?? false;

  const closeMobile = () => shell?.closeMobileSidebar();

  const hasAtLeastIntern = useMemo(() => {
    if (!profile) return false;
    if (profile.is_admin) return true;

    const roleText = `${profile.positionTitle ?? ""} ${profile.roleName ?? ""}`.toLowerCase();
    return (
      roleText.includes("intern") ||
      roleText.includes("officer") ||
      roleText.includes("executive") ||
      roleText.includes("admin")
    );
  }, [profile]);

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.requiredAnyPermissions?.length) {
          return hasAnyPermission(profile, item.requiredAnyPermissions);
        }
        if (item.requiredPermission) {
          return can(item.requiredPermission);
        }
        return true;
      }),
    [can, profile]
  );

  const canSeeTeamManagement = useMemo(
    () => hasAnyPermission(profile, ["manage_officers", "manage_teams"]),
    [profile]
  );

  const canSeeManagement = useMemo(() => {
    if (!hasAtLeastIntern) return false;

    return (
      hasAnyPermission(profile, ["manage_events"]) ||
      hasAnyPermission(profile, ["manage_tickets"]) ||
      hasAnyPermission(profile, ["manage_point_categories", "manage_points"]) ||
      hasAnyPermission(profile, ["manage_officers"]) ||
      hasAnyPermission(profile, ["manage_memberships"]) ||
      canSeeTeamManagement
    );
  }, [hasAtLeastIntern, profile, canSeeTeamManagement]);

  const canSeePointManagement = useMemo(
    () =>
      hasAnyPermission(profile, [
        "manage_point_categories",
        "manage_points",
      ]),
    [profile]
  );

  const canSeePointInformationInOther = useMemo(
    () =>
      hasAnyPermission(profile, [
        "view_point_categories",
        "manage_point_categories",
      ]) && !canSeePointManagement,
    [profile, canSeePointManagement]
  );

  const content = (
    <aside
      className={`flex h-full min-h-0 shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ${
        collapsed ? "w-18" : "w-56"
      }`}
    >
      <div
        className={`flex h-14 shrink-0 items-center border-b border-border px-3 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && (
          <Link
            href="/dashboard"
            className="font-bold text-card-foreground no-underline"
          >
            Coco
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className={`h-5 w-5 transition-transform duration-200 ${
              collapsed ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <nav
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2"
        aria-label="Dashboard navigation"
      >
        {visibleNavItems.map(({ href, label, icon }) => {
          const isActive = isMainNavActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={closeMobile}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "nav-accent-active border shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } ${collapsed ? "justify-center px-2" : ""} border border-transparent`}
              title={collapsed ? label : undefined}
            >
              {icon}
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {canSeeManagement ? (
        <div className="shrink-0 border-t border-border p-2">
          <button
            type="button"
            onClick={() => setManagementOpen((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground ${
              collapsed ? "justify-center px-2" : ""
            }`}
            aria-expanded={managementOpen}
            aria-controls="sidebar-management-group"
          >
            <svg
              className="h-5 w-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Management</span>
                <svg
                  className={`h-4 w-4 transition-transform ${
                    managementOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </>
            )}
          </button>

          {managementOpen && (
            <div
              id="sidebar-management-group"
              className={`mt-1 space-y-0.5 ${collapsed ? "hidden" : ""}`}
            >
              {hasAnyPermission(profile, ["manage_events"]) ? (
                <Link
                  href="/dashboard/events/manage"
                  onClick={closeMobile}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    pathname.startsWith("/dashboard/events/manage")
                      ? "nav-accent-active border shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } border border-transparent`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Events management</span>
                </Link>
              ) : null}

              {can("manage_officers") ? (
                <Link
                  href="/dashboard/officers"
                  onClick={closeMobile}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    pathname.startsWith("/dashboard/officers")
                      ? "nav-accent-active border shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } border border-transparent`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <span>Officers</span>
                </Link>
              ) : null}

              {can("manage_officers") ? (
                <Link
                  href="/dashboard/permissions"
                  onClick={closeMobile}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    pathname.startsWith("/dashboard/permissions")
                      ? "nav-accent-active border shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } border border-transparent`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-10V6m0 12v-2m8-4a8 8 0 11-16 0 8 8 0 0116 0z"
                    />
                  </svg>
                  <span>Permissions</span>
                </Link>
              ) : null}

              {canSeeTeamManagement ? (
                <Link
                  href="/dashboard/team-management"
                  onClick={closeMobile}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    pathname.startsWith("/dashboard/team-management")
                      ? "nav-accent-active border shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } border border-transparent`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <span>Team management</span>
                </Link>
              ) : null}

              {can("manage_tickets") ? (
                <Link
                  href="/dashboard/ticket-management"
                  onClick={closeMobile}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    pathname.startsWith("/dashboard/ticket-management")
                      ? "nav-accent-active border shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } border border-transparent`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 11l3 3L22 4"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"
                    />
                  </svg>
                  <span>Ticket management</span>
                </Link>
              ) : null}

              {canSeePointManagement ? (
                <Link
                  href="/dashboard/point-management"
                  onClick={closeMobile}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    pathname.startsWith("/dashboard/point-management")
                      ? "nav-accent-active border shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } border border-transparent`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                  <span>Point management</span>
                </Link>
              ) : null}

              {can("manage_memberships") ? (
                <Link
                  href="/dashboard/memberships"
                  onClick={closeMobile}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    pathname.startsWith("/dashboard/memberships")
                      ? "nav-accent-active border shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } border border-transparent`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span>Member memberships</span>
                </Link>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="shrink-0 border-t border-border p-2">
        <button
          type="button"
          onClick={() => setOtherOpen((v) => !v)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground ${
            collapsed ? "justify-center px-2" : ""
          }`}
          aria-expanded={otherOpen}
          aria-controls="sidebar-other-group"
        >
          <svg
            className="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v.01M12 12v.01M12 18v.01"
            />
          </svg>
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Other</span>
              <svg
                className={`h-4 w-4 transition-transform ${
                  otherOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </>
          )}
        </button>

        {otherOpen && (
          <div
            id="sidebar-other-group"
            className={`mt-1 space-y-0.5 ${collapsed ? "hidden" : ""}`}
          >
            <Link
              href="/dashboard/tickets"
              onClick={closeMobile}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                pathname === "/dashboard/tickets"
                  ? "nav-accent-active border shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } border border-transparent`}
            >
              <svg
                className="h-5 w-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 11l3 3L22 4"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"
                />
              </svg>
              <span>Tickets</span>
            </Link>

            {canSeePointInformationInOther ? (
              <Link
                href="/dashboard/point-information"
                onClick={closeMobile}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  pathname === "/dashboard/point-information"
                    ? "nav-accent-active border shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } border border-transparent`}
              >
                <svg
                  className="h-5 w-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
                <span>Point Infomation</span>
              </Link>
            ) : null}

            <Link
              href="/dashboard/settings"
              onClick={closeMobile}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                pathname === "/dashboard/settings"
                  ? "nav-accent-active border shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } border border-transparent`}
            >
              <svg
                className="h-5 w-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Settings</span>
            </Link>
          </div>
        )}
      </div>

      {themeContext && (
        <div className="shrink-0 border-t border-border p-2">
          <button
            type="button"
            onClick={() => themeContext.cycleTheme()}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground ${
              collapsed ? "justify-center px-2" : ""
            }`}
            title={`Theme: ${themeContext.theme} (click to cycle)`}
            aria-label={`Theme: ${themeContext.theme}. Click to cycle theme.`}
          >
            <ThemeIcon theme={themeContext.theme} />
            {!collapsed && (
              <span className="capitalize">{themeContext.theme}</span>
            )}
          </button>
        </div>
      )}
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar (in layout flow). */}
      <div className="hidden h-full sm:block">{content}</div>

      {/* Mobile drawer sidebar (overlays content). */}
      <div className="sm:hidden">
        {mobileOpen ? (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={closeMobile}
            className="fixed inset-0 z-40 bg-black/40"
          />
        ) : null}
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Ensure the drawer has its own background. */}
          <div className="h-dvh bg-card shadow-xl">{content}</div>
        </div>
      </div>
    </>
  );
}
