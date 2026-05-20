"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DataCard } from "@/components/ui/DataCard";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type AttendanceRow = {
  student_group_id?: string | null;
  status?: string;
};
type GroupRow = { id: string; student_group_name: string };
type InvoiceRow = { status: string; total: number };
type ApplicantRow = {
  id: string;
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  program_id: string;
  application_status: string;
  application_date?: string | null;
};
type ScheduleRow = {
  id: string;
  title?: string | null;
  course_id?: string;
  from_time?: string;
  to_time?: string;
  schedule_date: string;
  instructor_name?: string | null;
  room_id?: string | null;
};
type ExamPlan = {
  id: string;
  assessment_name: string;
  schedule_date?: string | null;
  from_time?: string | null;
  to_time?: string | null;
};
type ProgramRow = { id: string; program_name: string };

function greetingName(name?: string | null) {
  const first = (name || "there").split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatLongDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Past";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 14) return `${diff} days`;
  const weeks = Math.round(diff / 7);
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}

function applicantName(a: ApplicantRow) {
  return [a.first_name, a.middle_name, a.last_name].filter(Boolean).join(" ");
}

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  Applied: { dot: "bg-amber-500", bg: "bg-[var(--accent-yellow-bg)]", text: "text-amber-800" },
  Approved: { dot: "bg-emerald-500", bg: "bg-[var(--accent-green-bg)]", text: "text-emerald-800" },
  Admitted: { dot: "bg-blue-500", bg: "bg-[var(--accent-blue-bg)]", text: "text-blue-800" },
  Rejected: { dot: "bg-red-500", bg: "bg-[var(--accent-red-bg)]", text: "text-red-800" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.Applied;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function DonutChart({ percent }: { percent: number }) {
  const p = Math.min(100, Math.max(0, percent));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="10"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold">{Math.round(p)}%</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { token, user, hasPermission } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [stats, setStats] = useState<{
    students: number;
    teachers: number;
    guardians: number;
    groups: number;
  } | null>(null);
  const [attendanceByGroup, setAttendanceByGroup] = useState<
    Array<{ name: string; pct: number; present: number; absent: number; late: number }>
  >([]);
  const [feesSummary, setFeesSummary] = useState<{
    collectedPct: number;
    paid: { count: number; amount: number };
    partial: { count: number; amount: number };
    overdue: { count: number; amount: number };
  } | null>(null);
  const [agenda, setAgenda] = useState<ScheduleRow[]>([]);
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [programs, setPrograms] = useState<Record<string, string>>({});
  const [exams, setExams] = useState<ExamPlan[]>([]);
  const [termLabel, setTermLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!token && typeof window === "undefined") return;
    const opts = { token: token ?? undefined };

    Promise.all([
      api<unknown[]>("/api/students?limit=500", opts).catch(() => []),
      api<unknown[]>("/api/instructors?limit=500", opts).catch(() => []),
      api<unknown[]>("/api/guardians?limit=500", opts).catch(() => []),
      api<GroupRow[]>("/api/student-groups?limit=200", opts).catch(() => []),
    ]).then(([students, teachers, guardians, groups]) => {
      setStats({
        students: students?.length ?? 0,
        teachers: teachers?.length ?? 0,
        guardians: guardians?.length ?? 0,
        groups: groups?.length ?? 0,
      });
    });

    api<ProgramRow[]>("/api/programs?limit=100", opts)
      .then((list) => {
        const map: Record<string, string> = {};
        list.forEach((p) => {
          map[p.id] = p.program_name;
        });
        setPrograms(map);
      })
      .catch(() => {});

    api<{ current_academic_term_id?: string | null }>("/api/settings", opts)
      .then(async (s) => {
        if (!s.current_academic_term_id) return;
        const terms = await api<Array<{ id: string; term_name: string }>>("/api/academic/terms", opts).catch(
          () => []
        );
        const t = terms.find((x) => x.id === s.current_academic_term_id);
        if (t) setTermLabel(t.term_name);
      })
      .catch(() => {});

    Promise.all([
      api<AttendanceRow[]>(`/api/attendance?date=${today}&limit=500`, opts).catch(() => []),
      api<GroupRow[]>("/api/student-groups?limit=50", opts).catch(() => []),
    ]).then(([attendance, groups]) => {
      const byGroup: Record<string, { present: number; absent: number; late: number; total: number }> = {};
      groups.forEach((g) => {
        byGroup[g.id] = { present: 0, absent: 0, late: 0, total: 0 };
      });
      attendance.forEach((a) => {
        const gid = a.student_group_id || "_unassigned";
        if (!byGroup[gid]) byGroup[gid] = { present: 0, absent: 0, late: 0, total: 0 };
        byGroup[gid].total += 1;
        const st = (a.status || "").toLowerCase();
        if (st === "present") byGroup[gid].present += 1;
        else if (st === "absent") byGroup[gid].absent += 1;
        else if (st === "late") byGroup[gid].late += 1;
      });
      const nameMap = Object.fromEntries(groups.map((g) => [g.id, g.student_group_name]));
      const rows = Object.entries(byGroup)
        .filter(([, v]) => v.total > 0)
        .map(([id, v]) => ({
          name: nameMap[id] || "Unassigned",
          pct: Math.round((v.present / v.total) * 100),
          present: v.present,
          absent: v.absent,
          late: v.late,
        }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 6);
      setAttendanceByGroup(rows);
    });

    if (hasPermission("invoices.read") || hasPermission("fees.read") || user?.is_superuser) {
      api<InvoiceRow[]>("/api/invoices?limit=500", opts)
        .then((invoices) => {
          const buckets = {
            paid: { count: 0, amount: 0 },
            partial: { count: 0, amount: 0 },
            overdue: { count: 0, amount: 0 },
            pending: { count: 0, amount: 0 },
          };
          invoices.forEach((inv) => {
            const key = inv.status in buckets ? (inv.status as keyof typeof buckets) : "pending";
            buckets[key].count += 1;
            buckets[key].amount += inv.total;
          });
          const total = invoices.length || 1;
          const collectedPct = Math.round((buckets.paid.count / total) * 100);
          setFeesSummary({
            collectedPct,
            paid: buckets.paid,
            partial: buckets.partial,
            overdue: buckets.overdue,
          });
        })
        .catch(() => setFeesSummary(null));
    }

    api<ScheduleRow[]>(`/api/course-schedules?from_date=${today}&to_date=${today}&limit=20`, opts)
      .then(setAgenda)
      .catch(() => setAgenda([]));

    if (hasPermission("admissions.process") || user?.is_superuser) {
      api<ApplicantRow[]>("/api/applicants?limit=8", opts)
        .then(setApplicants)
        .catch(() => setApplicants([]));
    }

    api<ExamPlan[]>("/api/assessment/plans", opts)
      .then((plans) => {
        const upcoming = plans
          .filter((p) => p.schedule_date && p.schedule_date >= today)
          .sort((a, b) => (a.schedule_date || "").localeCompare(b.schedule_date || ""))
          .slice(0, 5);
        setExams(upcoming);
      })
      .catch(() => setExams([]));
  }, [token, today, hasPermission, user?.is_superuser]);

  const feesTotal =
    feesSummary
      ? feesSummary.paid.amount + feesSummary.partial.amount + feesSummary.overdue.amount
      : 0;

  return (
    <div className="space-y-8 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] tracking-tight">
            {timeGreeting()}, {greetingName(user?.full_name)}.
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {formatLongDate()}
            {termLabel ? ` · ${termLabel}` : ""}
            {stats?.groups != null ? ` · ${stats.groups} active classes` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm font-medium text-[var(--foreground)] hover:border-[var(--border-strong)]"
          >
            Export
          </button>
          <Link
            href="/dashboard/admissions"
            className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 inline-flex items-center gap-1"
          >
            + New admission
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <DataCard
          title="Enrolled students"
          value={stats ? stats.students.toLocaleString() : "—"}
          subtitle={stats ? "Across all programs" : undefined}
        />
        <DataCard
          title="Teaching staff"
          value={stats ? stats.teachers.toLocaleString() : "—"}
          subtitle={stats ? "Instructors on record" : undefined}
        />
        <DataCard
          title="Guardians"
          value={stats ? stats.guardians.toLocaleString() : "—"}
          subtitle="Linked parent accounts"
        />
        <DataCard
          title="Classes"
          value={stats ? stats.groups.toLocaleString() : "—"}
          subtitle="Student groups"
          showSparkline={false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashboardCard title="Attendance by class" actionHref="/dashboard/attendance">
          {attendanceByGroup.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-6 text-center">
              No attendance marked for today yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {attendanceByGroup.map((row) => (
                <li key={row.name}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-[var(--foreground)] truncate pr-2">{row.name}</span>
                    <span className="text-[var(--muted)] shrink-0">{row.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--primary-light)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--foreground)] transition-all"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--muted-light)] mt-1">
                    P {row.present} · A {row.absent} · L {row.late}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard title="Fees overview" actionHref="/dashboard/fees">
          {!feesSummary ? (
            <p className="text-sm text-[var(--muted)] py-6 text-center">
              {hasPermission("fees.read") || user?.is_superuser
                ? "No invoices yet."
                : "You don’t have permission to view fees."}
            </p>
          ) : (
            <div className="flex gap-5 items-center">
              <DonutChart percent={feesSummary.collectedPct} />
              <ul className="flex-1 space-y-3 text-sm">
                {(
                  [
                    { key: "paid", label: "Paid", color: "bg-emerald-500" },
                    { key: "partial", label: "Partial", color: "bg-amber-500" },
                    { key: "overdue", label: "Overdue", color: "bg-red-500" },
                  ] as const
                ).map(({ key, label, color }) => {
                  const b = feesSummary[key];
                  return (
                    <li key={key} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[var(--muted)]">
                        <span className={`w-2 h-2 rounded-full ${color}`} />
                        {label}
                      </span>
                      <span className="text-right">
                        <span className="font-medium text-[var(--foreground)]">{b.count}</span>
                        <span className="text-[var(--muted-light)] text-xs ml-1">
                          · {b.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </span>
                    </li>
                  );
                })}
                {feesTotal > 0 && (
                  <li className="text-[11px] text-[var(--muted-light)] pt-1 border-t border-[var(--border)]">
                    Total billed: {feesTotal.toLocaleString()}
                  </li>
                )}
              </ul>
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Today’s routine" actionHref="/dashboard/schedule">
          {agenda.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-6 text-center">Nothing scheduled for today.</p>
          ) : (
            <ul className="space-y-4">
              {agenda.slice(0, 5).map((ev) => (
                <li key={ev.id} className="flex gap-3">
                  <div className="text-xs text-[var(--muted)] w-14 shrink-0 pt-0.5">
                    {ev.from_time?.slice(0, 5) || "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {ev.title || ev.course_id || "Session"}
                    </p>
                    <p className="text-xs text-[var(--muted)] truncate">
                      {ev.instructor_name || "Staff"}
                      {ev.to_time ? ` · until ${ev.to_time.slice(0, 5)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium px-2 py-1 rounded-full bg-[var(--accent-blue-bg)] text-blue-800">
                    class
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardCard title="Recent admissions" actionHref="/dashboard/admissions">
          {applicants.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-8 text-center">No applicants on file.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold tracking-wide text-[var(--muted-light)] uppercase border-b border-[var(--border)]">
                    <th className="pb-3 pr-4 font-semibold">Applicant</th>
                    <th className="pb-3 pr-4 font-semibold">Program</th>
                    <th className="pb-3 pr-4 font-semibold">Submitted</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((a) => (
                    <tr key={a.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[var(--primary-light)] flex items-center justify-center text-xs font-semibold shrink-0">
                            {a.first_name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--foreground)]">{applicantName(a)}</p>
                            <p className="text-[11px] text-[var(--muted-light)]">{a.id.slice(0, 12)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-[var(--muted)]">
                        {programs[a.program_id] || a.program_id}
                      </td>
                      <td className="py-3 pr-4 text-[var(--muted)]">
                        {a.application_date
                          ? new Date(a.application_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={a.application_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Upcoming exams" actionHref="/dashboard/exam">
          {exams.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-8 text-center">No upcoming assessment plans.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {exams.map((ex) => (
                <li key={ex.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">{ex.assessment_name}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      {ex.schedule_date
                        ? new Date(ex.schedule_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Date TBD"}
                      {ex.from_time ? ` · ${String(ex.from_time).slice(0, 5)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--primary-light)] text-[var(--muted)]">
                    {daysUntil(ex.schedule_date) ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
