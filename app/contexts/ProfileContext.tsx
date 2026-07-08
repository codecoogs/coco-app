"use client";

import { createClient } from "@/lib/supabase/client";
import { fetchUserProfile } from "@/lib/supabase/profile";
import type { UserProfile } from "@/lib/types/rbac";
import type { PermissionName } from "@/lib/types/rbac";
import { hasPermission } from "@/lib/types/rbac";
import type { User } from "@supabase/supabase-js";
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
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberPublic, setMemberPublic] = useState<MemberPublicSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (uid: string) => {
      setError(null);
      const [p, usersRes] = await Promise.all([
        fetchUserProfile(supabase, uid),
        supabase
          .from("users")
          .select("first_name, last_name, avatar_url")
          .eq("auth_id", uid)
          .maybeSingle(),
      ]);
      setProfile(p);
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
  }, [user?.id, loadProfile]);

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

  const value = useMemo(
    () => ({
      user,
      profile,
      memberPublic,
      loading,
      error,
      refetchProfile,
      can,
    }),
    [user, profile, memberPublic, loading, error, refetchProfile, can],
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
