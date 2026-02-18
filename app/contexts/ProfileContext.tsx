"use client";

import { createClient } from "@/lib/supabase/client";
import { fetchUserProfile } from "@/lib/supabase/profile";
import type { UserProfile } from "@/lib/types/rbac";
import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ProfileContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetchProfile: () => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (uid: string) => {
      setError(null);
      const p = await fetchUserProfile(supabase, uid);
      setProfile(p);
    },
    [supabase]
  );

  const refetchProfile = useCallback(async () => {
    if (!user?.id) return;
    await loadProfile(user.id);
  }, [user?.id, loadProfile]);

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
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      refetchProfile,
    }),
    [user, profile, loading, error, refetchProfile]
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
