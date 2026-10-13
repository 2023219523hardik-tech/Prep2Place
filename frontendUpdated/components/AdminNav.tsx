"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAdminToken } from "@/lib/adminApi";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/question-bank", label: "Question Bank & Vault" },
  { href: "/admin/questions", label: "Interview Questions" },
  { href: "/admin/game", label: "Games" },
  { href: "/admin/aptitude", label: "Aptitude" },
  { href: "/admin/jobs", label: "Job Opportunities" },
  { href: "/admin/tests", label: "Custom Tests" },
  { href: "/admin/coding-assessments", label: "Coding Assessments" },
  { href: "/admin/coding-problem", label: "Coding Problems" },
  { href: "/admin/roles", label: "Job Roles" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Do not display admin navigation on the login page.
  if (pathname === "/admin/login") {
    return null;
  }

  function logout() {
    clearAdminToken();
    router.push("/admin/login");
  }

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Branding + Navigation */}
        <div className="flex items-center gap-6 min-w-0">
          {/* Branding */}
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 shrink-0"
            aria-label="Prep2Place Admin Dashboard"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-icon-64.png"
              alt="Prep2Place"
              className="h-7 w-7 rounded-lg"
            />

            <span className="font-display font-semibold text-slate-800 whitespace-nowrap">
              Prep
              <span className="text-teal-500">2</span>
              Place{" "}
              <span className="text-slate-400 font-medium">
                Admin
              </span>
            </span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-4 text-sm overflow-x-auto whitespace-nowrap">
            {LINKS.map((link) => {
              const isActive =
                pathname === link.href ||
                pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "text-premium-700 font-semibold"
                      : "text-slate-500 hover:text-slate-900 transition-colors"
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          className="ml-4 shrink-0 text-sm text-slate-500 hover:text-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}