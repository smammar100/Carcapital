"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Sidebar collapse state for the dashboard shell. Persists across sessions
 * via localStorage so the layout doesn't flash on reload.
 */
const STORAGE_KEY = "cc:shell:sidebar-collapsed";

interface SidebarStateValue {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

const SidebarStateContext = createContext<SidebarStateValue | null>(null);

export function useSidebarState(): SidebarStateValue {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) throw new Error("useSidebarState must be inside <SidebarStateProvider>");
  return ctx;
}

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "1") setCollapsedState(true);
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  return (
    <SidebarStateContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </SidebarStateContext.Provider>
  );
}
