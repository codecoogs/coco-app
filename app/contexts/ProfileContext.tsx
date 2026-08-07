"use client";

import { createClient } from "@/lib/supabase/client";
import { fetchUserProfile } from "@/lib/supabase/profile";
import type { UserProfile } from "@/lib/types/rbac";
import type { PermissionName } from "@/lib/types/rbac";
import { hasPermission } from "@/lib/types/rbac";
import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** Display fields from public.users (names, avatar). Kept in sync via refetchProfile(). */
export type MemberPublicSnapshot = {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

type ProfileContextValue = {
  user: User | null;
  profile: UserProfile | null;
  /** First/last name and avatar from public.users for UI (navbar, etc.). */
  memberPublic: MemberPublicSnapshot | null;
  /** True if the user has a membership row that's active and not past its end date. */
  hasActiveMembership: boolean;
  loading: boolean;
  error: string | null;
  refetchProfile: () => Promise<void>;
  /** Returns true if the current user has the permission (or is_admin). Use for UI protection. */
  can: (permission: PermissionName) => boolean;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  /** Optional server-passed user to avoid flash; client will still sync with auth. */
  initialUser?: User | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberPublic, setMemberPublic] = useState<MemberPublicSnapshot | null>(
    null,
  );
  const [hasActiveMembership, setHasActiveMembership] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (uid: string) => {
      setError(null);
      const todayIso = new Date().toISOString().slice(0, 10);
      const [p, usersRes, membershipsRes] = await Promise.all([
        fetchUserProfile(supabase, uid),
        supabase
          .from("users")
          .select("first_name, last_name, avatar_url")
          .eq("auth_id", uid)
          .maybeSingle(),
        // RLS (memberships_select_own) already scopes this to the signed-in
        // user's own rows - just check whether any are currently in force.
        supabase
          .from("memberships")
          .select("id")
          .eq("status", "active")
          .gte("ends_at", todayIso)
          .limit(1),
      ]);
      setProfile(p);
      setHasActiveMembership(!!membershipsRes.data?.length);
      if (usersRes.error) {
        console.error(
          "Error loading public.users row:",
          usersRes.error.message ?? usersRes.error.code,
        );
        setMemberPublic(null);
      } else {
        const row = usersRes.data as {
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
        } | null;
        if (!row) {
          setMemberPublic(null);
        } else {
          setMemberPublic({
            firstName: row.first_name?.trim() ?? "",
            lastName: row.last_name?.trim() ?? "",
            avatarUrl: row.avatar_url?.trim() ? row.avatar_url.trim() : null,
          });
        }
      }
    },
    [supabase],
  );

  const refetchProfile = useCallback(async () => {
    if (!user?.id) return;
    await loadProfile(user.id);
  }, [user, loadProfile]);

  const can = useCallback(
    (permission: PermissionName) => hasPermission(profile, permission),
    [profile]
  );

  useEffect(() => {
    let mounted = true;

    const sync = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user ?? null;
      if (!mounted) return;
      setUser(u);
      if (u?.id) {
        await loadProfile(u.id);
      } else {
        setProfile(null);
        setMemberPublic(null);
        setHasActiveMembership(false);
      }
      setLoading(false);
    };

    sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_, session) => {
      const u = session?.user ?? null;
      if (!mounted) return;
      setUser(u);
      if (u?.id) {
        await loadProfile(u.id);
      } else {
        setProfile(null);
        setMemberPublic(null);
        setHasActiveMembership(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!user?.id) return;
    const onFocus = () => refetchProfile();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id, refetchProfile]);

  // Session genuinely unavailable (expired/signed out elsewhere) after the initial
  // check settled -- point the user back to login instead of leaving a dead-end UI
  // where the rest of the dashboard still renders but shows no account details.
  useEffect(() => {
    if (loading || user) return;
    const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [loading, user, pathname, router]);

  const value = useMemo(
    () => ({
      user,
      profile,
      memberPublic,
      hasActiveMembership,
      loading,
      error,
      refetchProfile,
      can,
    }),
    [user, profile, memberPublic, hasActiveMembership, loading, error, refetchProfile, can],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}

export function useProfileOptional(): ProfileContextValue | null {
  return useContext(ProfileContext);
}
