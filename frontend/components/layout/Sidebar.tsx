"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const iconClass = "w-[18px] h-[18px] shrink-0";

const icons = {
  home: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  graduation: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
  users: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  grid: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  bookMarked: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  calendar: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  clipboard: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  fileSearch: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  book: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  bell: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-6-6 6 6 0 00-6 6v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  building: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  folder: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  settings: (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

type SubItem = { href: string; label: string };
type NavItem =
  | { href: string; label: string; icon: keyof typeof icons; badge?: number }
  | { label: string; icon: keyof typeof icons; children: SubItem[] };

type NavGroup = { heading: string; items: NavItem[] };

function buildNavGroups(_schoolType: string): NavGroup[] {
  return [
    {
      heading: "Main",
      items: [{ href: "/dashboard", label: "Overview", icon: "home" }],
    },
    {
      heading: "People",
      items: [
        {
          label: "Students",
          icon: "graduation",
          children: [
            { href: "/dashboard/students/by-class", label: "By class" },
            { href: "/dashboard/students", label: "All students" },
            { href: "/dashboard/students/new", label: "Add student" },
          ],
        },
        {
          label: "Teachers",
          icon: "users",
          children: [
            { href: "/dashboard/teachers", label: "All teachers" },
            { href: "/dashboard/teachers/new", label: "Add teacher" },
          ],
        },
      ],
    },
    {
      heading: "Academics",
      items: [
        { href: "/dashboard/schedule", label: "Routine", icon: "calendar" },
        { href: "/dashboard/attendance", label: "Attendance", icon: "clipboard" },
        { href: "/dashboard/exam", label: "Exams", icon: "fileSearch" },
      ],
    },
    {
      heading: "Operations",
      items: [
        { href: "/dashboard/admissions", label: "Admissions", icon: "fileSearch" },
        { href: "/dashboard/fees", label: "Fees", icon: "book" },
        { href: "/dashboard/notices", label: "Notices", icon: "bell" },
        { href: "/dashboard/clubs", label: "Clubs", icon: "building" },
        { href: "/dashboard/files", label: "Files", icon: "folder" },
      ],
    },
    {
      heading: "System",
      items: [{ href: "/dashboard/settings", label: "Settings", icon: "settings" }],
    },
  ];
}

const NAV_PERMISSIONS: Record<string, string | undefined> = {
  "/dashboard/admissions": "admissions.process",
  "/dashboard/attendance": "attendance.read",
  "/dashboard/exam": "exams.read",
  "/dashboard/fees": "fees.read",
  "/dashboard/notices": "notices.read",
};

function roleLabel(user?: { role?: string; is_superuser?: boolean; roles?: string[] }) {
  if (user?.is_superuser) return "Super admin";
  if (user?.roles?.length) return user.roles.join(" · ");
  const r = user?.role || "Staff";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function Sidebar({
  schoolName = "School",
  user,
  onLogout,
}: {
  schoolName?: string;
  user?: { full_name?: string | null; email?: string; role?: string; is_superuser?: boolean; roles?: string[] };
  onLogout?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, hasPermission } = useAuth();
  const [schoolType, setSchoolType] = useState("program");
  const [academicYearLabel, setAcademicYearLabel] = useState<string | null>(null);
  const [noticeCount, setNoticeCount] = useState(0);

  const navGroups = useMemo(() => buildNavGroups(schoolType), [schoolType]);

  const yearIdRef = useRef<string | null>(null);

  const loadSchoolMeta = useCallback(() => {
    api<{ school_type?: string; current_academic_year_id?: string | null }>("/api/settings", {
      token: token ?? undefined,
    })
      .then(async (s) => {
        setSchoolType(s.school_type || "program");
        const yearId = s.current_academic_year_id ?? null;
        if (!yearId) {
          setAcademicYearLabel(null);
          yearIdRef.current = null;
          return;
        }
        if (yearId === yearIdRef.current) return;
        yearIdRef.current = yearId;
        const years = await api<Array<{ id: string; academic_year_name: string }>>(
          "/api/academic/years?include_counts=false",
          { token: token ?? undefined }
        ).catch(() => []);
        const y = years.find((yr) => yr.id === yearId);
        setAcademicYearLabel(y?.academic_year_name ?? null);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadSchoolMeta();
  }, [loadSchoolMeta]);

  useEffect(() => {
    const onUpdated = () => loadSchoolMeta();
    window.addEventListener("school-settings-updated", onUpdated);
    return () => window.removeEventListener("school-settings-updated", onUpdated);
  }, [loadSchoolMeta]);

  useEffect(() => {
    if (!hasPermission("notices.read") && !token) return;
    api<unknown[]>("/api/notices?limit=50", { token: token ?? undefined })
      .then((list) => setNoticeCount(list?.length ?? 0))
      .catch(() => setNoticeCount(0));
  }, [token, hasPermission]);

  const filterItem = (item: NavItem): NavItem | null => {
    if ("href" in item) {
      const perm = NAV_PERMISSIONS[item.href];
      if (perm && !hasPermission(perm)) return null;
      if (item.href === "/dashboard/notices" && noticeCount > 0) {
        return { ...item, badge: noticeCount };
      }
      return item;
    }
    return item;
  };

  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.map(filterItem).filter(Boolean) as NavItem[],
    }))
    .filter((g) => g.items.length > 0);

  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const open: string[] = [];
    visibleGroups.forEach((g) =>
      g.items.forEach((item) => {
        if ("children" in item) {
          if (item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))) {
            open.push(item.label);
          }
        }
      })
    );
    return open;
  });

  const toggleOpen = (label: string) => {
    setOpenKeys((prev) =>
      prev.includes(label) ? prev.filter((k) => k !== label) : [...prev, label]
    );
  };

  const initials = (schoolName || "S")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const userInitial = (user?.full_name || user?.email || "U")[0].toUpperCase();

  const matchHref = (href: string) => {
    const [path, query] = href.split("?");
    if (path === "/dashboard") return pathname === "/dashboard";
    if (query) {
      if (pathname !== path) return false;
      const want = new URLSearchParams(query);
      const tab = want.get("tab");
      const current = searchParams.get("tab");
      if (tab) return current === tab;
      return !current;
    }
    return pathname === path || pathname.startsWith(path + "/");
  };

  /** When several child links share a prefix, only the most specific match is active. */
  const getActiveChildHref = (children: SubItem[]): string | null => {
    const matches = children.filter((c) => matchHref(c.href));
    if (matches.length === 0) return null;
    return matches.reduce((best, c) => (c.href.length > best.href.length ? c : best)).href;
  };

  const isActive = (href: string) => matchHref(href);

  return (
    <aside className="w-64 min-h-screen bg-[var(--sidebar)] border-r border-[var(--border)] flex flex-col shrink-0">
      <div className="px-4 pt-5 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-semibold font-serif">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate leading-tight">{schoolName}</p>
            {academicYearLabel && (
              <p className="text-[11px] text-[var(--muted)] truncate mt-0.5">{academicYearLabel}</p>
            )}
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto space-y-5 pb-4">
        {visibleGroups.map((group) => (
          <div key={group.heading}>
            <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--muted-light)] uppercase">
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                if ("children" in item) {
                  const isOpen = openKeys.includes(item.label);
                  const activeChildHref = getActiveChildHref(item.children);
                  const childActive = activeChildHref !== null;
                  return (
                    <div key={item.label}>
                      <button
                        type="button"
                        onClick={() => toggleOpen(item.label)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                          childActive
                            ? "text-[var(--foreground)]"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <span className={childActive ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
                          {icons[item.icon]}
                        </span>
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          {icons.chevronDown}
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden ml-9 mt-0.5 space-y-0.5"
                          >
                            {item.children.map((c) => {
                              const selected = c.href === activeChildHref;
                              return (
                                <Link
                                  key={c.href}
                                  href={c.href}
                                  className={`block px-3 py-1.5 text-sm rounded-full transition-colors ${
                                    selected
                                      ? "bg-[var(--primary)] text-white font-medium"
                                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                                  }`}
                                >
                                  {c.label}
                                </Link>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span className={active ? "text-white" : "text-[var(--muted)]"}>{icons[item.icon]}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {"badge" in item && item.badge != null && item.badge > 0 && (
                      <span
                        className={`min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-semibold ${
                          active ? "bg-white/20 text-white" : "bg-[var(--border-strong)] text-[var(--muted)]"
                        }`}
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 mt-auto">
        <div className="rounded-xl bg-white border border-[var(--border)] p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--primary-light)] flex items-center justify-center text-sm font-semibold text-[var(--foreground)] shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {user?.full_name || "User"}
              </p>
              <p className="text-[11px] text-[var(--muted)] truncate">{roleLabel(user)}</p>
            </div>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="mt-3 w-full text-left text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] px-1"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
