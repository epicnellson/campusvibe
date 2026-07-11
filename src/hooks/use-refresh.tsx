import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type RefreshContextType = {
  feedKey: number;
  triggerFeedRefresh: () => void;
};

const RefreshContext = createContext<RefreshContextType>({
  feedKey: 0,
  triggerFeedRefresh: () => {},
});

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [feedKey, setFeedKey] = useState(0);

  const triggerFeedRefresh = useCallback(() => {
    setFeedKey((k) => k + 1);
  }, []);

  return (
    <RefreshContext.Provider value={{ feedKey, triggerFeedRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
