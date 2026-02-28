"use client";

import { useState } from "react";

interface HeaderProps {
  user?: { full_name?: string; email?: string; role?: string };
  onLogout?: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">&#128269;</span>
          <input
            type="text"
            placeholder="What do you want to find?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7A4CFF]/20 focus:border-[#7A4CFF]"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button type="button" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">Notify</button>
        <button type="button" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">Chat</button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            <div className="w-8 h-8 rounded-full bg-[#7A4CFF]/20 flex items-center justify-center text-[#7A4CFF] font-semibold">
              {(user?.full_name || user?.email || "U")[0].toUpperCase()}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">{user?.full_name || "User"}</p>
              <p className="text-xs text-gray-500">{user?.role || "Admin"}</p>
            </div>
            <span className="text-gray-400">&#9660;</span>
          </button>
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} aria-hidden />
              <div className="absolute right-0 mt-1 w-48 py-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                <button
                  type="button"
                  onClick={() => { onLogout?.(); setDropdownOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
