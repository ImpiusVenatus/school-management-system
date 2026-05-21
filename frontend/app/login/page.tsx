"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Instrument_Serif } from "next/font/google";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/Checkbox";
import { IosArrowButton } from "@/components/ui/IosArrowButton";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

type RoleTab = "staff" | "teacher" | "student" | "guardian";

const ROLE_TABS: { id: RoleTab; label: string }[] = [
  { id: "staff", label: "Staff" },
  { id: "teacher", label: "Teacher" },
  { id: "student", label: "Student" },
  { id: "guardian", label: "Guardian" },
];

const ROLE_HINTS: Record<RoleTab, string> = {
  staff: "Administrators and office staff use your school-issued email.",
  teacher: "Teachers sign in with the email linked to their instructor profile.",
  student: "Students use the email address on their enrollment record.",
  guardian: "Guardians sign in with the address they registered with the school.",
};

function GridPattern() {
  return (
    <div
      className="absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
      }}
    />
  );
}

function MailIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-13.5a2.25 2.25 0 01-2.25-2.25V6.75m16.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.34 0l-7.5-4.615a2.25 2.25 0 01-1.07-1.916V6.75m16.5 0h-15" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9-4.5 4.5 4.5 0 00-9 4.5v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25h10.5z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login, setupStatus, checkSetup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleTab>("staff");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  const displaySchool = setupStatus?.school_name?.trim() || "School Management System";
  const initials = displaySchool
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "SMS";

  return (
    <div
      className={`min-h-screen min-h-[100dvh] flex flex-col lg:flex-row ${instrumentSerif.variable}`}
    >
      {/* Left — brand panel */}
      <div className="relative flex flex-col justify-between bg-[#0c0c0c] text-white px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12 lg:w-[48%] lg:min-h-screen lg:shrink-0 overflow-hidden">
        <GridPattern />
        <div className="relative z-10 flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white flex items-center justify-center shrink-0">
            <span className="text-[#0c0c0c] font-semibold text-base sm:text-lg font-serif">{initials}</span>
          </div>
          <span className="text-sm font-medium tracking-tight text-white/95 truncate">{displaySchool}</span>
        </div>

        <div className="relative z-10 flex flex-col justify-center py-8 sm:py-12 lg:py-0 lg:flex-1 max-w-md">
          <h1
            className={`${instrumentSerif.className} text-[1.75rem] leading-[1.2] sm:text-4xl sm:leading-[1.15] lg:text-[3.25rem] text-white font-normal`}
          >
            A quieter way to run the school day.
          </h1>
          <p className="mt-4 sm:mt-6 text-sm sm:text-base text-white/55 leading-relaxed max-w-sm">
            One system for admissions, attendance, timetables, exams, and fees — built for the people who keep the school running.
          </p>
        </div>

        <div className="relative z-10 hidden sm:flex justify-between gap-4 text-[11px] text-white/40 tracking-wide">
          <span>SMS · v1.0</span>
          <span className="text-right">Single-school · Open source</span>
        </div>
      </div>

      {/* Right — sign in */}
      <div className="flex-1 flex flex-col justify-center bg-[#f7f5f0] px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-12 lg:px-16 lg:py-16 lg:min-h-screen min-w-0">
        <div className="w-full max-w-md mx-auto min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-neutral-400 uppercase mb-2 sm:mb-3">
            Sign in
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-900 tracking-tight">
            Welcome back.
          </h2>
          <p className="mt-2 sm:mt-3 text-sm text-neutral-500 leading-relaxed">{ROLE_HINTS[role]}</p>

          {/* Role pills — horizontal scroll on narrow screens */}
          <div className="mt-6 sm:mt-8 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex flex-nowrap sm:flex-wrap gap-2 min-w-min sm:min-w-0 pb-0.5 sm:pb-0">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRole(tab.id)}
                className={`shrink-0 px-3.5 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  role === tab.id
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 sm:mt-8 space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-neutral-500 mb-1.5">
                Email
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 sm:px-4 py-3 min-h-[48px] focus-within:ring-2 focus-within:ring-neutral-900/10 focus-within:border-neutral-400 transition-shadow">
                <MailIcon />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  className="flex-1 min-w-0 bg-transparent text-base sm:text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-neutral-500">
                  Password
                </label>
                <span className="text-xs text-neutral-400 cursor-not-allowed" title="Contact your school administrator">
                  Forgot?
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 sm:px-4 py-3 min-h-[48px] focus-within:ring-2 focus-within:ring-neutral-900/10 focus-within:border-neutral-400 transition-shadow">
                <LockIcon />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 min-w-0 bg-transparent text-base sm:text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
                />
              </div>
            </div>

            <Checkbox
              checked={keepSignedIn}
              onChange={setKeepSignedIn}
              label="Keep me signed in on this device"
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <IosArrowButton loading={loading} loadingLabel="Signing in…">
              Sign in
            </IosArrowButton>
          </form>

          {setupStatus && !setupStatus.configured ? (
            <div className="mt-6 sm:mt-8 rounded-xl border border-neutral-200 bg-white/80 px-4 py-4">
              <p className="text-sm font-medium text-neutral-800">First-time setup</p>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                No school has been configured yet. Create your institution and the first administrator account.
              </p>
              <Link
                href="/setup"
                className="inline-block mt-3 text-sm font-semibold text-neutral-900 hover:underline"
              >
                Complete school setup →
              </Link>
            </div>
          ) : (
            <div className="mt-6 sm:mt-8 rounded-xl border border-neutral-200 bg-white/60 px-4 py-4">
              <p className="text-sm text-neutral-600 leading-relaxed">
                <span className="font-medium text-neutral-800">Secure sign-in.</span> Your session uses encrypted tokens. Staff manage roles and permissions under Settings → Roles.
              </p>
            </div>
          )}

          <div className="mt-8 sm:mt-10 flex flex-wrap justify-center sm:justify-start gap-x-3 gap-y-2 text-xs text-neutral-400">
            <span>EN</span>
            <span className="text-neutral-300">·</span>
            <Link href="/dashboard" className="hover:text-neutral-600">
              Dashboard
            </Link>
            <span className="text-neutral-300">·</span>
            <span className="text-neutral-400">Help</span>
            <span className="text-neutral-300">·</span>
            <span className="text-neutral-400">Privacy</span>
            <span className="text-neutral-300">·</span>
            <span className="text-neutral-400">Terms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
