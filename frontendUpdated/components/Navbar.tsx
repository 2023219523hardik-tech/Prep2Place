"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

/**
 * PRIMARY
 * Core preparation modules.
 *
 * These should remain directly accessible because they are
 * the main day-to-day student workflows.
 */
const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/jobs", label: "Placement", icon: "briefcase" },
  { href: "/coding", label: "Coding", icon: "code" },
  { href: "/aptitude", label: "Aptitude", icon: "calculator" },
  { href: "/technical-mcq", label: "Technical MCQ", icon: "test" },
  { href: "/games", label: "Games", icon: "game" },
  { href: "/mock-tests", label: "Mock Tests", icon: "test" },
  { href: "/interview", label: "Interview", icon: "mic" },
  { href: "/coding-lab", label: "Coding Lab", icon: "code" }
];

/**
 * SECONDARY
 * Supporting/profile/reporting modules.
 */
const SECONDARY: NavItem[] = [
  { href: "/jobs/applications", label: "My Applications", icon: "briefcase" },
  { href: "/jobs/hiring-progress", label: "Hiring Progress", icon: "activity" },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/readiness", label: "Readiness", icon: "target" },
  { href: "/skill-gap", label: "Skill Gap", icon: "chart" },
  { href: "/recommendations", label: "Resources", icon: "book" },
  { href: "/progress", label: "Progress", icon: "activity" },
];

const ALL_ITEMS = [...PRIMARY, ...SECONDARY];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;

  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const moreRef = useRef<HTMLDivElement>(null);

  /**
   * Close menus after navigation.
   */
  useEffect(() => {
    setMoreOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  /**
   * Close More dropdown when clicking outside.
   */
  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (
        moreRef.current &&
        !moreRef.current.contains(event.target as Node)
      ) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  if (!user) {
    return null;
  }

  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word: string) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const secondaryHasActive = SECONDARY.some((item) =>
    isActive(pathname, item.href)
  );

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-5 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3 py-2">
          {/* =====================================================
              BRAND + DESKTOP NAVIGATION
          ====================================================== */}
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2"
              aria-label="Prep2Place Dashboard"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-icon-64.png"
                alt="Prep2Place"
                className="h-8 w-8 rounded-lg"
              />

              <span className="font-display text-lg font-bold tracking-tight">
                Prep
                <span className="text-teal-500">2</span>
                Place
              </span>
            </Link>

            {/* =================================================
                DESKTOP
                All core preparation modules remain visible.
                Secondary modules stay inside More.
            ================================================== */}
            <div className="hidden items-center gap-1 lg:flex">
              {PRIMARY.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                />
              ))}

              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((value) => !value)}
                  aria-expanded={moreOpen}
                  aria-haspopup="menu"
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all ${
                    secondaryHasActive
                      ? "bg-premium-50 text-premium-700 shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  More

                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    className={`shrink-0 opacity-70 transition-transform ${
                      moreOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {moreOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl"
                  >
                    {SECONDARY.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive(pathname, item.href)
                            ? "bg-premium-50 text-premium-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <NavIcon name={item.icon} />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* =====================================================
              USER AREA
          ====================================================== */}
          <div className="flex items-center gap-2 whitespace-nowrap sm:gap-3">
            <div className="hidden items-center gap-2.5 pr-1 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-premium-700 text-xs font-bold text-white shadow-sm">
                {initials}
              </div>

              <div className="leading-tight">
                <div className="text-sm font-semibold text-slate-800">
                  {user.fullName}
                </div>

                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {user.role}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              Logout
            </button>

            {/* =================================================
                MOBILE / TABLET MENU
            ================================================== */}
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              aria-expanded={mobileOpen}
              aria-label={
                mobileOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              {mobileOpen ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* =======================================================
            MOBILE / TABLET NAVIGATION
            Vertical grid. No horizontal scrolling.
        ======================================================== */}
        {mobileOpen && (
          <div className="grid grid-cols-1 gap-1.5 border-t border-slate-100 py-3 sm:grid-cols-2 lg:hidden">
            {ALL_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(pathname, item.href)
                    ? "bg-premium-50 text-premium-700"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

/* ===============================================================
   PRIMARY NAV LINK
================================================================ */

function NavLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all ${
        active
          ? "bg-premium-50 text-premium-700 shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <NavIcon name={item.icon} />
      {item.label}
    </Link>
  );
}

/* ===============================================================
   NAV ICONS
================================================================ */

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard:
      "M4 13h7V4H4v9Zm9 7h7V4h-7v16ZM4 20h7v-5H4v5Z",

    briefcase:
      "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2ZM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",

    profile:
      "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",

    target:
      "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",

    chart:
      "M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-3",

    code:
      "m9 18-6-6 6-6m6 12 6-6-6-6",

    calculator:
      "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01",

    mic:
      "M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm7-3a7 7 0 0 1-14 0m7 7v3",

    book:
      "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H7a3 3 0 0 0-3 3V5.5Zm0 0V22",

    activity:
      "M4 12h4l2-6 4 12 2-6h4",

    test:
      "M9 3h6m-5 0v5.5L5.5 18a1.5 1.5 0 0 0 1.3 2.2h10.4a1.5 1.5 0 0 0 1.3-2.2L14 8.5V3",

    game:
      "M6 12h4m-2-2v4m7-3h.01M18 13h.01M8 6h8a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-1l-1.5 2h-3L9 18H8a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4Z",
  };

  const path = paths[name];

  if (!path) {
    return null;
  }

  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 opacity-80"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

