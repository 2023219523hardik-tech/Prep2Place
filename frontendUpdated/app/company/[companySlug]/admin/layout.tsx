"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { clearTokens } from "@/lib/api";

export default function CompanyAdminLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const companySlug = (params.companySlug as string) || "sif360";

  const [adminUser, setAdminUser] = useState<{ fullName?: string; email?: string } | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{ name?: string; slug?: string } | null>(null);

  const isLoginPage = pathname.endsWith("/login");

  useEffect(() => {
    if (isLoginPage) return;

    // Check token
    const token = localStorage.getItem("adminAccessToken") || localStorage.getItem("accessToken");
    const rawUser = localStorage.getItem("companyAdminUser");
    const rawCompany = localStorage.getItem("companyAdminCompany");

    if (!token) {
      router.push(`/company/${companySlug}/admin/login`);
      return;
    }

    if (rawUser) {
      try {
        setAdminUser(JSON.parse(rawUser));
      } catch {}
    }
    if (rawCompany) {
      try {
        setCompanyInfo(JSON.parse(rawCompany));
      } catch {}
    }
  }, [companySlug, isLoginPage, router]);

  function handleLogout() {
    clearTokens();
    localStorage.removeItem("adminAccessToken");
    localStorage.removeItem("companyAdminUser");
    localStorage.removeItem("companyAdminCompany");
    router.push(`/company/${companySlug}/admin/login`);
  }

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  const navLinks = [
    { label: "Dashboard & Funnel", href: `/company/${companySlug}/admin/dashboard` },
    { label: "Job Postings", href: `/company/${companySlug}/admin/jobs` },
    { label: "+ Post Job", href: `/company/${companySlug}/admin/jobs/create` },
    { label: "Candidates Directory", href: `/company/${companySlug}/admin/candidates` },
    { label: "Interviews", href: `/company/${companySlug}/admin/interviews` },
    { label: "Reports & Analytics", href: `/company/${companySlug}/admin/reports` },
  ];

  const displayName = companyInfo?.name || companySlug.toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Company Admin Navigation */}
      <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        {/* Brand & Company Slug */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href={`/company/${companySlug}/admin/dashboard`} className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {displayName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm tracking-tight">{displayName}</span>
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider border border-indigo-200/50">
                  Company Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Prep2Place Hiring Suite</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 pl-4 border-l border-slate-200">
            {navLinks.map((link) => {
              const active = pathname === link.href || (link.href !== `/company/${companySlug}/admin/dashboard` && pathname.startsWith(link.href) && link.href !== `/company/${companySlug}/admin/jobs/create`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-bold text-slate-800">{adminUser?.fullName || "Administrator"}</p>
            <p className="text-[11px] text-slate-400">{adminUser?.email || "admin@company.com"}</p>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-rose-600 transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}
