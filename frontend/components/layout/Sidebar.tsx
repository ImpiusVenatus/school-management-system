"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Home", icon: "⌂" },
  {
    label: "Admin",
    icon: "▤",
    children: [
      { href: "/dashboard/students", label: "Students" },
      { href: "/dashboard/teachers", label: "Teachers" },
    ],
  },
  { href: "/dashboard/students", label: "Students", icon: "🎓" },
  { href: "/dashboard/teachers", label: "Teachers", icon: "👤" },
  { href: "/dashboard/student-groups", label: "Class", icon: "📋" },
  { href: "/dashboard/courses", label: "Subject", icon: "📚" },
  { href: "/dashboard/schedule", label: "Routine", icon: "📅" },
  { href: "/dashboard/attendance", label: "Attendance", icon: "✓" },
  { href: "/dashboard/exam", label: "Exam", icon: "📝" },
  { href: "/dashboard/notices", label: "Notice", icon: "📢" },
  { href: "/dashboard/clubs", label: "Clubs", icon: "🏫" },
  { href: "/dashboard/files", label: "Files", icon: "📁" },
  { href: "/dashboard/settings", label: "Account", icon: "⚙" },
];

export function Sidebar({ schoolName = "School" }: { schoolName?: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <div className="rounded-lg bg-[#7A4CFF] text-white px-3 py-2 text-sm font-semibold">
          {schoolName}
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if ("children" in item) {
            const isActive = item.children.some((c) => c.href === pathname);
            return (
              <div key={item.label}>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive ? "bg-[#7A4CFF] text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                <div className="ml-4 mt-1 space-y-0.5">
                  {item.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className={`block px-3 py-2 rounded-lg text-sm ${
                        pathname === c.href ? "bg-[#7A4CFF]/10 text-[#7A4CFF]" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          }
          const isActive = pathname === (item as { href: string }).href;
          return (
            <Link
              key={(item as { href: string }).href}
              href={(item as { href: string }).href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                isActive ? "bg-[#7A4CFF] text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
