import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { db_ops } from "@/services/db";
import { useSession } from "@/hooks/use-session";
import type { Profile } from "@/services/database.types";

type ProfileContextType = {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => void;
};

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  isLoading: true,
  error: null,
  refreshProfile: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshProfile = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (!session?.user?.id) {
      setProfile(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let initialDone = false;

    const unsub = db_ops.subscribeToDoc("profiles", session.user.id, (data) => {
      setProfile(data as unknown as Profile | null);
      if (!initialDone) {
        initialDone = true;
        setIsLoading(false);
      }
    });

    unsubRef.current = unsub;

    const timeout = setTimeout(() => {
      if (!initialDone) {
        initialDone = true;
        setIsLoading(false);
        setError("Connection timed out");
      }
    }, 10000);

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, [session?.user?.id, refreshKey]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, error, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
