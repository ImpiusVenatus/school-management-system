"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

export function Header() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const crumbs = getBreadcrumbs(pathname ?? "/dashboard");

  return (
    <header className="h-14 sm:h-16 bg-[var(--background)] border-b border-[var(--border)] flex items-center gap-4 px-4 sm:px-6 shrink-0">
      <nav className="hidden sm:flex items-center gap-1.5 text-sm shrink-0 min-w-0 max-w-[200px] lg:max-w-xs">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span className="text-[var(--muted-light)]">/</span>}
            {c.href ? (
              <Link href={c.href} className="text-[var(--muted)] hover:text-[var(--foreground)] truncate">
                {c.label}
              </Link>
            ) : (
              <span className="text-[var(--foreground)] font-medium truncate">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex-1 flex justify-center min-w-0 max-w-2xl mx-auto">
        <div className="relative w-full">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-light)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.75}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search students, teachers, notices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-14 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:outline-none focus:ring-2 focus:ring-neutral-900/8 focus:border-[var(--border-strong)]"
          />
          <kbd className="hidden sm:inline absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--muted-light)] bg-[var(--primary-light)] border border-[var(--border)] rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          type="button"
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-sm text-[var(--muted)] hover:border-[var(--border-strong)]"
          title="Date range filter (coming soon)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>This week</span>
        </button>
        <Link
          href="/dashboard/notices"
          className="relative p-2.5 rounded-xl hover:bg-white border border-transparent hover:border-[var(--border)] text-[var(--muted)]"
          aria-label="Notices"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-6-6 6 6 0 00-6 6v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--accent-red)]" />
        </Link>
        <Link
          href="/dashboard/settings"
          className="p-2.5 rounded-xl hover:bg-white border border-transparent hover:border-[var(--border)] text-[var(--muted)]"
          aria-label="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
