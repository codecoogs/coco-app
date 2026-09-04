"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "@/app/dashboard/notifications/actions";

const POLL_INTERVAL_MS = 90_000;

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const { count } = await getUnreadNotificationCount();
      if (!mounted) return;
      setUnreadCount(count);
    };
    refresh();
    const onFocus = () => {
      refresh();
    };
    window.addEventListener("focus", onFocus);
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    };
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [open]);

  const handleToggleOpen = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const { data } = await getRecentNotifications(20);
      setNotifications(data);
      setListLoaded(true);
    }
  }, [open]);

  const handleClickNotification = useCallback(
    async (n: NotificationRow) => {
      setOpen(false);
      if (!n.read_at) {
        setNotifications((prev) =>
          prev.map((x) =>
            x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        await markNotificationRead(n.id);
      }
      if (n.link) router.push(n.link);
    },
    [router]
  );

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
    setUnreadCount(0);
    await markAllNotificationsRead();
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => void handleToggleOpen()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
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
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-medium text-card-foreground">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!listLoaded ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => void handleClickNotification(n)}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-muted ${
                    n.read_at ? "" : "bg-blue-50 dark:bg-blue-950/20"
                  }`}
                >
                  <span className="text-sm font-medium text-card-foreground">
                    {n.title}
                  </span>
                  {n.body ? (
                    <span className="text-xs text-muted-foreground">{n.body}</span>
                  ) : null}
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(n.created_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
