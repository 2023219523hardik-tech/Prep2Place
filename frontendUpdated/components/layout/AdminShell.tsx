"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth";
import { clearAdminToken } from "@/lib/adminApi";
import { ToastPortal } from "@/components/ui/Toast";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "OVERVIEW",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" }],
  },
  {
    title: "USERS",
    items: [{ href: "/admin/students", label: "Students", icon: "users" }],
  },
  {
    title: "CONTENT",
    items: [
      { href: "/admin/questions", label: "Question Bank", icon: "database" },
      { href: "/admin/question-bank", label: "Admin Question Bank", icon: "database" },
      { href: "/admin/game", label: "Games", icon: "gamepad-2" },
      { href: "/admin/aptitude", label: "Aptitude", icon: "calculator" },
      { href: "/admin/coding-problem", label: "Coding Problems", icon: "code" },
      { href: "/admin/roles", label: "Job Roles", icon: "target" },
    ],
  },
  {
    title: "ASSESSMENTS",
    items: [
      { href: "/admin/tests", label: "Custom Tests", icon: "library" },
      { href: "/admin/coding-assessments", label: "Coding Assessments", icon: "briefcase" },
      { href: "/admin/live-monitoring", label: "Live Monitoring", icon: "activity" },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { href: "/admin/reports", label: "Reports Hub", icon: "chart-bar" },
    ],
  },
  {
    title: "PLACEMENT",
    items: [
      { href: "/admin/jobs", label: "Job Opportunities", icon: "briefcase" },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isActive(pathname, item.href)) {
        return item.label;
      }
    }
  }
  return "Dashboard";
}

const ADMIN_NAV_ITEM_BASE =
  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-transparent text-slate-300 hover:bg-white/5 hover:text-white";
const ADMIN_NAV_ITEM_ACTIVE =
  "bg-premium-700/30 text-white border-l-2 border-premium-400 pl-[10px]";

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileSidebarOpen(false);
    setUserDropdownOpen(false);
    setNotificationsOpen(false);
    setSettingsOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const isAdminUser = user && (user.role === "ADMIN" || (user as unknown as { isAdmin?: boolean }).isAdmin);

  const initials = (user?.fullName ?? "A")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pageTitle = getPageTitle(pathname);

  function handleLogout() {
    clearAdminToken();
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-surface-workspace">
      {/* =============================================================
          SIDEBAR (DESKTOP)
      ============================================================= */}
      <aside
        className="hidden lg:flex flex-col fixed top-0 left-0 h-screen border-r border-white/10 bg-ink-900 z-40 text-white/90"
        style={{ width: "var(--sidebar-width)" }}
      >
        {/* BRAND */}
        <div
          className="flex flex-col justify-center border-b border-white/10"
          style={{ height: "var(--topbar-height)", padding: "0 20px" }}
        >
          <Link
            href="/admin/dashboard"
            className="flex flex-col"
            aria-label="Prep2Place Admin Console"
          >
            <span className="text-eyebrow uppercase font-semibold tracking-[0.18em] text-premium-400">
              CONSOLE
            </span>
            <span className="font-display font-bold text-white tracking-tight text-base mt-0.5">
              PREP2PLACE ADMIN
            </span>
          </Link>
        </div>

        {/* NAV CONTENT */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.title} className={gIdx > 0 ? "mt-5" : ""}>
              <div className="nav-group-title !text-white/40 px-3 mb-1 mt-0 first:mt-0 text-[10.5px] font-semibold uppercase tracking-[0.14em]">
                {group.title}
              </div>
              <ul className="space-y-1 px-0">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`${ADMIN_NAV_ITEM_BASE} ${active ? ADMIN_NAV_ITEM_ACTIVE : ""}`}
                      >
                        <Icon name={item.icon} size={18} strokeWidth={1.75} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* =============================================================
          MOBILE SIDEBAR OVERLAY (≤1024px)
      ============================================================= */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[var(--sidebar-width)] bg-ink-900 border-r border-white/10 flex flex-col animate-slide-in-right text-white/90">
            {/* BRAND */}
            <div
              className="flex items-center justify-between border-b border-white/10"
              style={{ height: "var(--topbar-height)", padding: "0 16px" }}
            >
              <Link
                href="/admin/dashboard"
                className="flex flex-col"
                onClick={() => setMobileSidebarOpen(false)}
              >
                <span className="text-eyebrow uppercase font-semibold tracking-[0.18em] text-premium-400">
                  CONSOLE
                </span>
                <span className="font-display font-bold text-white tracking-tight text-base mt-0.5">
                  PREP2PLACE ADMIN
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close navigation"
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* NAV */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
              {NAV_GROUPS.map((group, gIdx) => (
                <div key={group.title} className={gIdx > 0 ? "mt-5" : ""}>
                  <div className="nav-group-title !text-white/40 px-3 mb-1 mt-0 first:mt-0 text-[10.5px] font-semibold uppercase tracking-[0.14em]">
                    {group.title}
                  </div>
                  <ul className="space-y-1 px-0">
                    {group.items.map((item) => {
                      const active = isActive(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileSidebarOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={`${ADMIN_NAV_ITEM_BASE} ${active ? ADMIN_NAV_ITEM_ACTIVE : ""}`}
                          >
                            <Icon name={item.icon} size={18} strokeWidth={1.75} />
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* =============================================================
          TOPBAR
      ============================================================= */}
      <header
        className="fixed top-0 z-40 flex items-center justify-between border-b border-white/10 bg-ink-900/95 backdrop-blur"
        style={{
          height: "var(--topbar-height)",
          left: 0,
          right: 0,
          padding: "0 20px",
        }}
      >
        {/* Left: hamburger (mobile) + eyebrow + page title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="lg:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="flex flex-col justify-center">
            <span className="text-eyebrow uppercase font-semibold tracking-[0.18em] text-premium-400 leading-none">
              ADMIN
            </span>
            <h1 className="font-display font-semibold text-white tracking-tight text-sm mt-1 truncate">
              {pageTitle}
            </h1>
          </div>
        </div>

        {/* Right: search + icons + user */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Icon
              name="search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-lg bg-white/10 border border-white/15 px-3 py-1.5 pl-9 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-premium-400/50 focus:border-premium-400 transition-all"
            />
          </div>

          {/* Bell */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="menu"
              onClick={() => {
                setNotificationsOpen((v) => !v);
                setSettingsOpen(false);
                setUserDropdownOpen(false);
              }}
              className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Icon name="bell" size={18} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-premium-400 ring-2 ring-ink-900" />
            </button>
            {notificationsOpen && (
              <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-popover text-white">
                <div className="px-3 py-2.5 border-b border-white/10">
                  <div className="text-sm font-semibold text-white">Admin Alerts</div>
                  <div className="text-xs text-white/50 mt-0.5">Placement activity &amp; flagged reviews</div>
                </div>
                <div className="max-h-80 overflow-y-auto py-1">
                  <Link href="/admin/dashboard" onClick={() => setNotificationsOpen(false)} role="menuitem" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-premium-500/20 flex items-center justify-center text-premium-300 shrink-0">
                      <Icon name="dashboard" size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white/90 line-clamp-2">Admin dashboard</div>
                      <div className="text-xs text-white/40 mt-0.5">Overview KPIs &amp; placement stats</div>
                    </div>
                  </Link>
                  <Link href="/admin/students" onClick={() => setNotificationsOpen(false)} role="menuitem" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
                      <Icon name="users" size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white/90 line-clamp-2">Students roster</div>
                      <div className="text-xs text-white/40 mt-0.5">Manage students &amp; readiness</div>
                    </div>
                  </Link>
                  <Link href="/admin/technical-mcq" onClick={() => setNotificationsOpen(false)} role="menuitem" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-300 shrink-0">
                      <Icon name="test-tube" size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white/90 line-clamp-2">Technical MCQ bank</div>
                      <div className="text-xs text-white/40 mt-0.5">Upload &amp; manage questions</div>
                    </div>
                  </Link>
                </div>
                <div className="px-3 py-2 border-t border-white/10">
                  <Link href="/admin/dashboard" onClick={() => setNotificationsOpen(false)} className="block text-center text-xs font-semibold text-premium-300 hover:text-premium-200 transition-colors py-1.5">
                    View admin console &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              aria-label="Settings"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
              onClick={() => {
                setSettingsOpen((v) => !v);
                setNotificationsOpen(false);
                setUserDropdownOpen(false);
              }}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Icon name="settings" size={18} />
            </button>
            {settingsOpen && (
              <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-popover text-white">
                <Link href="/admin/roles" onClick={() => setSettingsOpen(false)} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/5 transition-colors">
                  <Icon name="target" size={16} />
                  Job Roles
                </Link>
                <Link href="/admin/questions" onClick={() => setSettingsOpen(false)} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/5 transition-colors">
                  <Icon name="database" size={16} />
                  Question Bank
                </Link>
                <Link href="/admin/coding-problem" onClick={() => setSettingsOpen(false)} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/5 transition-colors">
                  <Icon name="code" size={16} />
                  Coding Problems
                </Link>
                <Link href="/admin/tests" onClick={() => setSettingsOpen(false)} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/5 transition-colors">
                  <Icon name="library" size={16} />
                  Custom Tests
                </Link>
                <div className="my-1 h-px bg-white/10" />
                <Link href="/admin/dashboard" onClick={() => setSettingsOpen(false)} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/5 transition-colors">
                  <Icon name="dashboard" size={16} />
                  Dashboard
                </Link>
              </div>
            )}
          </div>

          {/* User dropdown */}
          <div className="relative" ref={userDropdownRef}>
            <button
              type="button"
              onClick={() => setUserDropdownOpen((v) => !v)}
              aria-expanded={userDropdownOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-white/5 transition-colors"
            >
              <div className="h-8 w-8 shrink-0 rounded-full bg-premium-700 flex items-center justify-center text-xs font-bold text-white shadow-sm border border-premium-500/30">
                {initials || "A"}
              </div>
              <Icon name="chevron-down" size={14} className="hidden sm:block text-white/40" />
            </button>

            {userDropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-popover text-white"
              >
                <div className="px-3 py-2.5 border-b border-white/10">
                  <div className="text-sm font-semibold text-white truncate">
                    {user?.fullName ?? "Admin User"}
                  </div>
                  <div className="text-xs text-white/50 truncate mt-0.5">
                    {user?.email ?? "admin@prep2place.com"}
                  </div>
                  <div className="mt-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-premium-700/30 text-premium-300 border border-premium-500/30">
                      Administrator
                    </span>
                  </div>
                </div>
                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full inline-flex items-center justify-start gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    <Icon name="logout" size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =============================================================
          MAIN CONTENT AREA
      ============================================================= */}
      <main
        className="min-h-[calc(100vh-56px)] bg-surface-workspace"
        style={{
          marginLeft: 0,
          marginTop: "var(--topbar-height)",
          padding: "24px 28px 40px",
        }}
      >
        {children}
      </main>

      {/* Desktop-only sidebar offset for topbar + main */}
      <style jsx global>{`
        @media (min-width: 1024px) {
          main[style] {
            margin-left: var(--sidebar-width) !important;
          }
          header[style] {
            margin-left: var(--sidebar-width) !important;
          }
        }
      `}</style>

      <ToastPortal />
    </div>
  );
}
