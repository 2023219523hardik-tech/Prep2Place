"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import StudentShell from "@/components/layout/StudentShell";

const NO_SHELL_PATHS = [
  "/",
  "/login",
  "/register",
  "/verify-email",
  "/oauth/callback",
  "/admin/login",
];

function isNoShellPath(pathname: string): boolean {
  return NO_SHELL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isLockdownExamPath(pathname: string): boolean {
  return (
    pathname.startsWith("/jobs/assessment") ||
    pathname.startsWith("/mock-tests/managed") ||
    pathname.startsWith("/mock-tests/aptitude") ||
    pathname.startsWith("/mock-tests/coding") ||
    pathname.startsWith("/coding-lab/") ||
    pathname.startsWith("/games/play") ||
    pathname.startsWith("/interview/")
  );
}

function isCompanyPath(pathname: string): boolean {
  return pathname.startsWith("/company") || pathname.startsWith("/company-admin");
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function isAdminUser(user: { role?: string; isAdmin?: boolean } | null): boolean {
  if (!user) return false;
  return user.isAdmin === true || user.role === "ADMIN";
}

function FallbackMain({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-5 lg:px-8">
      {children}
    </main>
  );
}

export default function ClientShellRouter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Proctoring lockdown examination paths must render directly edge-to-edge with NO portal shell
  if (isLockdownExamPath(pathname)) {
    return <>{children}</>;
  }

  // Company Admin pages have their own dedicated CompanyAdminLayout - avoid student shell & double padding
  if (isCompanyPath(pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return <FallbackMain>{children}</FallbackMain>;
  }

  if (isNoShellPath(pathname)) {
    return <FallbackMain>{children}</FallbackMain>;
  }

  // Admin pages have their own dedicated AdminShell in app/admin/layout.tsx - avoid outer FallbackMain margins
  if (isAdminPath(pathname)) {
    return <>{children}</>;
  }

  if (!user) {
    return <FallbackMain>{children}</FallbackMain>;
  }

  if (isAdminUser(user)) {
    return <FallbackMain>{children}</FallbackMain>;
  }

  return <StudentShell>{children}</StudentShell>;
}
