import React, { createContext, useCallback, useContext, useState } from "react";

type MuteContextType = {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
};

const MuteContext = createContext<MuteContextType>({
  isMuted: true,
  toggleMute: () => {},
  setMuted: () => {},
});

export function MuteProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState(true);

  const toggleMute = useCallback(() => setIsMuted((p) => !p), []);
  const setMuted = useCallback((muted: boolean) => setIsMuted(muted), []);

  return (
    <MuteContext.Provider value={{ isMuted, toggleMute, setMuted }}>
      {children}
    </MuteContext.Provider>
  );
}

export function useMute() {
  return useContext(MuteContext);
}
