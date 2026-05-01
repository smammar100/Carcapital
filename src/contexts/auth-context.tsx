"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authService } from "@/lib/services/auth-service";
import type { Company, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  company: Company | null;
  loading: boolean;
  signIn: (userId: string) => Promise<void>;
  signOut: () => void;
  switchCompany: (companyId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

const STORAGE_KEY = "cc:userId";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    if (!stored) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const u = await authService.getUser(stored);
        if (u) {
          const c = await authService.getCompany(u.companyId);
          setUser(u);
          setCompany(c);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function signIn(userId: string): Promise<void> {
    const u = await authService.getUser(userId);
    if (!u) throw new Error("User not found");
    const c = await authService.getCompany(u.companyId);
    window.localStorage.setItem(STORAGE_KEY, userId);
    setUser(u);
    setCompany(c);
  }

  function signOut(): void {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setCompany(null);
  }

  async function switchCompany(companyId: string): Promise<void> {
    if (user?.role !== "owner") throw new Error("Only owner can switch companies");
    const c = await authService.getCompany(companyId);
    setCompany(c);
  }

  return (
    <AuthContext.Provider
      value={{ user, company, loading, signIn, signOut, switchCompany }}
    >
      {children}
    </AuthContext.Provider>
  );
}
