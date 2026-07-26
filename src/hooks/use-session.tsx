import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth } from "@/services/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

type SessionContextType = {
  session: { user: { id: string; email: string | null } } | null;
  isLoading: boolean;
};

const SessionContext = createContext<SessionContextType>({
  session: null,
  isLoading: true,
});

function userToSession(user: User | null) {
  if (!user) return null;
  return { user: { id: user.uid, email: user.email } };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionContextType["session"]>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(userToSession(user));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ session, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
