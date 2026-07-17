import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { useSession } from "@/hooks/use-session";
import type { Profile } from "@/services/database.types";

type ProfileContextType = {
  profile: Profile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  isLoading: true,
  refreshProfile: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (e) {
      console.warn("Failed to fetch profile:", e);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn("Profile fetch timed out");
      setIsLoading(false);
    }, 5000);
    refreshProfile().finally(() => clearTimeout(timeout));
  }, [refreshProfile]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
