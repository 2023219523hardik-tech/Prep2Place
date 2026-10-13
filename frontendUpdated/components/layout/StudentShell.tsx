"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth";

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
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    ],
  },
  {
    title: "LEARN & PRACTICE",
    items: [
      { href: "/coding", label: "Coding", icon: "code" },
      { href: "/aptitude", label: "Aptitude", icon: "calculator" },
      { href: "/dashboard/technical-mcq", label: "Technical MCQ", icon: "test-tube" },
      { href: "/coding-lab", label: "Coding Lab", icon: "terminal" },
      { href: "/games", label: "Games", icon: "gamepad-2" },
    ],
  },
  {
    title: "ASSESS",
    items: [
      { href: "/mock-tests", label: "Mock Tests", icon: "library" },
      { href: "/interview", label: "Interview", icon: "mic" },
    ],
  },
  {
    title: "PLACEMENT",
    items: [
      { href: "/jobs", label: "Jobs & Opportunities", icon: "briefcase" },
      { href: "/jobs/applications", label: "My Applications", icon: "file-text" },
    ],
  },
  {
    title: "TRACK",
    items: [
      { href: "/profile", label: "Profile", icon: "user" },
      { href: "/progress", label: "Progress", icon: "chart-line" },
      { href: "/reports", label: "Reports", icon: "chart-bar" },
      { href: "/readiness", label: "Readiness", icon: "target" },
      { href: "/skill-gap", label: "Skill Gap", icon: "brain" },
      { href: "/recommendations", label: "Resources", icon: "book-open" },
    ],
  },
];

const MOBILE_BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/coding", label: "Coding", icon: "code" },
  { href: "/mock-tests", label: "Tests", icon: "library" },
  { href: "/interview", label: "Interview", icon: "mic" },
  { href: "/profile", label: "Profile", icon: "user" },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
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

export default function StudentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const mobileSidebarRef = useRef<HTMLDivElement>(null);

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

  if (!user) {
    return <>{children}</>;
  }

  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pageTitle = getPageTitle(pathname);
  const sidebarWidth = sidebarCollapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)";

  return (
    <div className="min-h-screen bg-surface-workspace">
      {/* =============================================================
          SIDEBAR (DESKTOP + COLLAPSIBLE)
      ============================================================= */}
      <aside
        className="hidden md:flex flex-col fixed top-0 left-0 h-screen border-r border-slate-200 bg-surface-sidebar z-40 transition-all duration-200"
        style={{ width: sidebarWidth }}
      >
        {/* BRAND */}
        <div
          className="flex items-center border-b border-slate-200"
          style={{ height: "var(--topbar-height)", padding: "0 16px" }}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2 shrink-0"
            aria-label="Prep2Place Dashboard"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-icon-64.png"
              alt="Prep2Place"
              className="h-8 w-8 rounded-lg shrink-0"
            />
            {!sidebarCollapsed && (
              <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap">
                <span className="gradient-text">PREP</span>
                <span className="text-slate-800">2PLACE</span>
              </span>
            )}
          </Link>
        </div>

        {/* NAV CONTENT */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.title} className={gIdx > 0 ? "mt-5" : ""}>
              {!sidebarCollapsed && (
                <div className="nav-group-title">{group.title}</div>
              )}
              {sidebarCollapsed && gIdx > 0 && (
                <div className="h-px w-full bg-slate-200/70 my-3 mx-2" />
              )}
              <ul className="space-y-1 px-0">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`nav-item ${active ? "nav-item-active" : ""} ${
                          sidebarCollapsed ? "justify-center px-2" : ""
                        }`}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <Icon name={item.icon} size={18} />
                        {!sidebarCollapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* COLLAPSE TOGGLE (xl+) */}
        <div className="hidden xl:block border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="nav-item w-full"
          >
            <Icon
              name={sidebarCollapsed ? "chevron-right" : "chevron-left"}
              size={18}
            />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* =============================================================
          MOBILE SIDEBAR OVERLAY
      ============================================================= */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside
            ref={mobileSidebarRef}
            className="absolute left-0 top-0 h-full w-[var(--sidebar-width)] bg-surface-sidebar border-r border-slate-200 flex flex-col animate-slide-in-right"
          >
            {/* BRAND */}
            <div
              className="flex items-center justify-between border-b border-slate-200"
              style={{ height: "var(--topbar-height)", padding: "0 16px" }}
            >
              <Link
                href="/dashboard"
                className="flex items-center gap-2"
                onClick={() => setMobileSidebarOpen(false)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-icon-64.png"
                  alt="Prep2Place"
                  className="h-8 w-8 rounded-lg"
                />
                <span className="font-display text-lg font-bold tracking-tight">
                  <span className="gradient-text">PREP</span>
                  <span className="text-slate-800">2PLACE</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close navigation"
                className="p-2 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* NAV */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
              {NAV_GROUPS.map((group, gIdx) => (
                <div key={group.title} className={gIdx > 0 ? "mt-5" : ""}>
                  <div className="nav-group-title">{group.title}</div>
                  <ul className="space-y-1 px-0">
                    {group.items.map((item) => {
                      const active = isActive(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileSidebarOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={`nav-item ${active ? "nav-item-active" : ""}`}
                          >
                            <Icon name={item.icon} size={18} />
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
        className="fixed top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/85 backdrop-blur"
        style={{
          height: "var(--topbar-height)",
          left: "0",
          right: "0",
          padding: "0 20px",
        }}
      >
        {/* Mobile hamburger + page title */}
        <div className="flex items-center gap-3 md:!ml-0" style={{ marginLeft: 0 }}>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <Icon name="menu" size={20} />
          </button>
          <h1 className="font-display font-semibold text-slate-900 tracking-tight text-base truncate">
            {pageTitle}
          </h1>
        </div>

        {/* Right: search + icons + user */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search */}
          <div className="relative hidden md:block">
            <Icon
              name="search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm !pl-10 w-80"
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
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <Icon name="bell" size={18} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-premium-600 ring-2 ring-white" />
            </button>
            {notificationsOpen && (
              <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-1.5 shadow-popover">
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-900">Notifications</div>
                  <div className="text-xs text-slate-500 mt-0.5">Recent placement activity</div>
                </div>
                <div className="max-h-80 overflow-y-auto py-1">
                  <Link href="/progress" onClick={() => setNotificationsOpen(false)} role="menuitem" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-premium-50 flex items-center justify-center text-premium-600 shrink-0">
                      <Icon name="chart-line" size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 line-clamp-2">View your progress dashboard</div>
                      <div className="text-xs text-slate-400 mt-0.5">Track mock test &amp; interview history</div>
                    </div>
                  </Link>
                  <Link href="/readiness" onClick={() => setNotificationsOpen(false)} role="menuitem" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                      <Icon name="target" size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 line-clamp-2">Check placement readiness</div>
                      <div className="text-xs text-slate-400 mt-0.5">See your readiness score</div>
                    </div>
                  </Link>
                  <Link href="/skill-gap" onClick={() => setNotificationsOpen(false)} role="menuitem" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                      <Icon name="brain" size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 line-clamp-2">Skill gap analysis</div>
                      <div className="text-xs text-slate-400 mt-0.5">Identify areas to improve</div>
                    </div>
                  </Link>
                </div>
                <div className="px-3 py-2 border-t border-slate-100">
                  <Link href="/progress" onClick={() => setNotificationsOpen(false)} className="block text-center text-xs font-semibold text-premium-700 hover:text-premium-800 transition-colors py-1.5">
                    View all activity &rarr;
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
              className="p-2 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <Icon name="settings" size={18} />
            </button>
            {settingsOpen && (
              <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-popover">
                <Link href="/profile" onClick={() => setSettingsOpen(false)} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <Icon name="user" size={16} />
                  Profile
                </Link>
                <Link href="/readiness" onClick={() => setSettingsOpen(false)} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <Icon name="target" size={16} />
                  Readiness
                </Link>
                <Link href="/skill-gap" onClick={() => setSettingsOpen(false)} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <Icon name="brain" size={16} />
                  Skill Gap
                </Link>
                <Link href="/recommendations" onClick={() => setSettingsOpen(false)} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <Icon name="book-open" size={16} />
                  Resources
                </Link>
                <div className="my-1 h-px bg-slate-100" />
                <Link href="/dashboard" onClick={() => setSettingsOpen(false)} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
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
              className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 transition-colors"
            >
              <div className="h-8 w-8 shrink-0 rounded-full bg-premium-700 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                {initials}
              </div>
              <Icon name="chevron-down" size={14} className="hidden sm:block text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-popover"
              >
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {user.fullName}
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">
                    {user.email}
                  </div>
                  <div className="mt-1.5">
                    <span className="badge badge-primary">Student</span>
                  </div>
                </div>
                <div className="py-1">
                  <button
                    type="button"
                    onClick={logout}
                    className="btn-ghost btn-sm w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
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
        className="min-h-screen"
        style={{
          marginLeft: 0,
          marginTop: "var(--topbar-height)",
          padding: "20px 24px 96px",
          maxWidth: "none",
        }}
      >
        <div className="md:!ml-0" style={{ marginLeft: 0 }}>
          {children}
        </div>
      </main>

      {/* =============================================================
          MOBILE BOTTOM NAV
      ============================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors ${
                    active ? "text-premium-700" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    size={20}
                    className={active ? "text-premium-700" : "text-slate-500"}
                  />
                  <span className="truncate px-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* =============================================================
          STYLES FOR DESKTOP SIDEBAR + TOPBAR (APPLIED VIA MEDIA)
      ============================================================= */}
      <style jsx global>{`
        @media (min-width: 768px) {
          main[style] {
            margin-left: ${sidebarCollapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)"} !important;
            padding-bottom: 32px !important;
          }
          header[style] {
            margin-left: ${sidebarCollapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)"} !important;
          }
          main[style] > div[style] {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
