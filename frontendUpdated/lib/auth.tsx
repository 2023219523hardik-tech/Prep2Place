"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, setTokens, clearTokens, getStoredUser, setStoredUser } from "./api";

export interface AuthUser {
  userId: number;
  email: string;
  fullName: string;
  role: string;
  premium: boolean;
  emailVerified: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  setAuthFromOAuth: (tokens: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  setUserVerified: () => void;
  resendVerification: (email: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<any>("/api/auth/login", { email, password }, true);
    setTokens(res.accessToken, res.refreshToken);
    const authUser: AuthUser = {
      userId: res.userId,
      email: res.email,
      fullName: res.fullName,
      role: res.role,
      premium: !!res.premium,
      emailVerified: !!res.emailVerified,
    };
    setStoredUser(authUser);
    setUser(authUser);
  }

  async function register(email: string, password: string, fullName: string) {
    const res = await api.post<any>("/api/auth/register", { email, password, fullName }, true);
    setTokens(res.accessToken, res.refreshToken);
    const authUser: AuthUser = {
      userId: res.userId,
      email: res.email,
      fullName: res.fullName,
      role: res.role,
      premium: !!res.premium,
      emailVerified: !!res.emailVerified,
    };
    setStoredUser(authUser);
    setUser(authUser);
  }

  function setAuthFromOAuth(tokens: { accessToken: string; refreshToken: string; user: AuthUser }) {
    setTokens(tokens.accessToken, tokens.refreshToken);
    setStoredUser(tokens.user);
    setUser(tokens.user);
  }

  function setUserVerified() {
    if (user) {
      const updated = { ...user, emailVerified: true };
      setStoredUser(updated);
      setUser(updated);
    }
  }

  function logout() {
    clearTokens();
    setUser(null);
    router.push("/login");
  }

  async function resendVerification(email: string) {
    await api.post("/api/auth/resend-verification", { email }, true);
  }

  async function verifyEmail(token: string) {
    const res = await api.get<any>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
    if (res?.emailVerified) {
      setUserVerified();
      return true;
    }
    return !!res?.success;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        setAuthFromOAuth,
        setUserVerified,
        resendVerification,
        verifyEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
