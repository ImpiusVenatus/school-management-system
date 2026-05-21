"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";

type AuditEvent = {
  id: string;
  time: string;
  dateLabel: string;
  actor: string;
  role: string;
  action: string;
  resource: string;
  ip: string;
  tag: string;
  changes?: string[];
  linked?: string[];
};

const EVENTS: AuditEvent[] = [
  {
    id: "evt-1",
    time: "09:42:18",
    dateLabel: "May 19",
    actor: "Anjali Mehta",
    role: "teacher",
    action: "attendance.bulk_mark",
    resource: "5A · 22 records",
    ip: "10.0.4.12",
    tag: "write",
    changes: ["+ Faris Demir — present", "+ Ines Aragón — absent", "20 more…"],
    linked: ["login", "attendance.read", "attendance.bulk_mark", "notifications.queue"],
  },
  {
    id: "evt-2",
    time: "09:38:02",
    dateLabel: "May 19",
    actor: "Nadia Khoury",
    role: "principal",
    action: "settings.update",
    resource: "School profile",
    ip: "10.0.2.8",
    tag: "admin",
  },
  {
    id: "evt-3",
    time: "09:12:44",
    dateLabel: "May 19",
    actor: "System",
    role: "system",
    action: "backup.completed",
    resource: "S3 nightly",
    ip: "—",
    tag: "system",
  },
  {
    id: "evt-4",
    time: "08:55:01",
    dateLabel: "May 19",
    actor: "Rohan Verma",
    role: "admin_staff",
    action: "student.create",
    resource: "STU-2026-1842",
    ip: "10.0.3.21",
    tag: "write",
  },
  {
    id: "evt-5",
    time: "08:41:19",
    dateLabel: "May 19",
    actor: "unknown@ext.io",
    role: "—",
    action: "auth.login_failed",
    resource: "—",
    ip: "203.0.113.44",
    tag: "security",
  },
];

const TAG_FILTERS = ["write", "admin", "security", "auth", "system"];

function TagPill({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    write: "bg-blue-50 text-blue-800",
    admin: "bg-violet-50 text-violet-800",
    security: "bg-red-50 text-red-800",
    auth: "bg-amber-50 text-amber-800",
    system: "bg-neutral-100 text-neutral-600",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[tag] ?? "bg-neutral-100"}`}>{tag}</span>
  );
}

export function AuditLogTab() {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(EVENTS[0].id);
  const meta = TAB_META["audit-log"];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EVENTS.filter((e) => {
      if (tagFilter && e.tag !== tagFilter) return false;
      if (!q) return true;
      return (
        e.actor.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.resource.toLowerCase().includes(q)
      );
    });
  }, [search, tagFilter]);

  const selected = filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle="Append-only record of state-changing actions. Preview data until the audit API is connected."
        actions={
          <>
            <SelectField
              label=""
              options={[
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
              ]}
              value="7"
              onChange={() => {}}
              className="min-w-[8rem]"
            />
            <button type="button" className={btnSecondary}>Export CSV</button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Events — 24h", value: "1,418" },
          { label: "Write actions", value: "412" },
          { label: "Auth events", value: "912" },
          { label: "System", value: "86" },
          { label: "Security", value: "8" },
        ].map((s) => (
          <Card key={s.label} className="py-3 px-4">
            <p className="text-[10px] uppercase text-[var(--muted)]">{s.label}</p>
            <p className="text-xl font-bold mt-1">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <input
          type="search"
          placeholder="User, action, resource id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
        {TAG_FILTERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTagFilter(tagFilter === t ? null : t)}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              tagFilter === t ? "bg-[var(--primary)] text-white" : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-[var(--muted)] border-b bg-neutral-50/80">
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">Actor</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Resource</th>
                  <th className="text-left px-4 py-3">IP</th>
                  <th className="text-left px-4 py-3">Tag</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`border-b border-[var(--border)] cursor-pointer hover:bg-neutral-50 ${
                      selected?.id === e.id ? "bg-[var(--primary-light)]" : ""
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-mono text-xs">{e.time}</p>
                      <p className="text-[10px] text-[var(--muted)]">{e.dateLabel}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.actor}</p>
                      <p className="text-[10px] text-[var(--muted)]">{e.role}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                    <td className="px-4 py-3">{e.resource}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{e.ip}</td>
                    <td className="px-4 py-3">
                      <TagPill tag={e.tag} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-xs text-[var(--muted)]">Showing 1–{filtered.length} of 9,418 (demo)</p>
        </Card>

        {selected && (
          <div className="space-y-4">
            <Card>
              <div className="flex items-start gap-2 mb-3">
                <TagPill tag={selected.tag} />
                <div>
                  <p className="font-mono text-sm font-semibold">{selected.action}</p>
                  <p className="text-[10px] text-[var(--muted)]">{selected.id} · {selected.dateLabel} {selected.time}</p>
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Actor</dt>
                  <dd>{selected.actor}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Resource</dt>
                  <dd>{selected.resource}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">IP</dt>
                  <dd>{selected.ip}</dd>
                </div>
              </dl>
              {selected.changes && (
                <div className="mt-4 pt-3 border-t border-[var(--border)]">
                  <p className="text-xs font-semibold mb-2">Changes</p>
                  <ul className="text-xs space-y-1 text-[var(--muted)]">
                    {selected.changes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.linked && (
                <div className="mt-4 pt-3 border-t border-[var(--border)]">
                  <p className="text-xs font-semibold mb-2">Linked events</p>
                  <ul className="text-xs space-y-1">
                    {selected.linked.map((l, i) => (
                      <li key={l} className="flex gap-2">
                        <span className="text-[var(--muted)]">{i + 1}.</span>
                        <span className="font-mono">{l}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <h4 className="text-sm font-semibold mb-3">Retention period</h4>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-xs text-[var(--muted)]">Hot storage (months)</label>
              <input type="number" defaultValue={36} className={`${inputClass} w-24 mt-1`} disabled />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Cold storage (months)</label>
              <input type="number" defaultValue={84} className={`${inputClass} w-24 mt-1`} disabled />
            </div>
          </div>
        </Card>
        <Card>
          <h4 className="text-sm font-semibold mb-2">Anomaly alerts</h4>
          <p className="text-xs text-[var(--muted)] mb-3">Email super admins when unusual activity is detected</p>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" defaultChecked disabled />
            5+ failed logins in 10 min
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked disabled />
            Role escalation to super_admin or principal
          </label>
        </Card>
      </div>
    </>
  );
}
