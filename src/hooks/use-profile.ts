import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase";
import { useSession } from "@/hooks/use-session";
import type { Profile } from "@/services/database.types";

export function useProfile() {
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (!cancelled) setProfile(data);
      } catch (e) {
        console.warn("Failed to fetch profile:", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session?.user?.id]);

  return { profile, isLoading };
}
