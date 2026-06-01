"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface DemoModeContextValue {
  demoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (v: boolean) => void;
}

const DemoModeContext = createContext<DemoModeContextValue>({
  demoMode: true,
  toggleDemoMode: () => {},
  setDemoMode: () => {},
});

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoModeState] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("nexusai_demo_mode");
    // Si nunca se guardó, default = true (demo ON para primera visita)
    setDemoModeState(stored === null ? true : stored === "true");
  }, []);

  function setDemoMode(v: boolean) {
    localStorage.setItem("nexusai_demo_mode", String(v));
    setDemoModeState(v);
  }

  function toggleDemoMode() {
    setDemoMode(!demoMode);
  }

  return (
    <DemoModeContext.Provider value={{ demoMode, toggleDemoMode, setDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
