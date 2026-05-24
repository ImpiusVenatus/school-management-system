"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api, getApiUrl } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnSecondary, inputClass } from "@/lib/ui";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";

type AuditLogItem = {
  id: string;
  created_at: string;
  time: string;
  date_label: string;
  actor: string;
  role: string | null;
  action: string;
  action_label: string;
  category: string;
  resource: string;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  status_code: number | null;
  http_method: string | null;
  path: string | null;
  changes: string[];
};

type AuditListResponse = {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
};

type AuditStats = {
  events_24h: number;
  write_actions: number;
  admin_events: number;
  auth_events: number;
  system_events: number;
  security_events: number;
};

const TAG_FILTERS = ["write", "admin", "security", "auth", "system"] as const;
const PAGE_SIZE = 50;

function TagPill({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    write: "bg-blue-50 text-blue-800",
    admin: "bg-violet-50 text-violet-800",
    security: "bg-red-50 text-red-800",
    auth: "bg-amber-50 text-amber-800",
    system: "bg-neutral-100 text-neutral-600",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[tag] ?? "bg-neutral-100"}`}>
      {tag}
    </span>
  );
}

function StatusBadge({ code }: { code: number | null }) {
  if (code == null) return <span className="text-[var(--muted)]">—</span>;
  const ok = code >= 200 && code < 300;
  const err = code >= 400;
  const cls = ok
    ? "bg-emerald-50 text-emerald-800"
    : err
      ? code >= 500
        ? "bg-red-50 text-red-800"
        : "bg-amber-50 text-amber-800"
      : "bg-neutral-100 text-neutral-600";
  return <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded ${cls}`}>{code}</span>;
}

function formatCount(n: number) {
  return n.toLocaleString();
}

export function AuditLogTab({ token }: { token?: string | null }) {
  const snackbar = useSnackbar();
  const meta = TAB_META["audit-log"];

  const [days, setDays] = useState("7");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [days, debouncedSearch, tagFilter]);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams({
      days,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (tagFilter) p.set("category", tagFilter);
    if (debouncedSearch) p.set("search", debouncedSearch);
    return p.toString();
  }, [days, page, tagFilter, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const [list, stat] = await Promise.all([
        api<AuditListResponse>(`/api/audit/logs?${queryParams}`, { token: token ?? undefined }),
        api<AuditStats>(`/api/audit/stats?days=${days}`, { token: token ?? undefined }),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setStats(stat);
      setSelectedId((prev) => {
        if (prev && list.items.some((i) => i.id === prev)) return prev;
        return list.items[0]?.id ?? null;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load audit log";
      if (msg.includes("403") || msg.toLowerCase().includes("permission")) {
        setForbidden(true);
      } else {
        snackbar.error(msg);
      }
      setItems([]);
      setTotal(0);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [queryParams, days, token, snackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = items.find((e) => e.id === selectedId) ?? null;
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function exportCsv() {
    setExporting(true);
    try {
      const p = new URLSearchParams({ days });
      if (tagFilter) p.set("category", tagFilter);
      if (debouncedSearch) p.set("search", debouncedSearch);
      const url = getApiUrl(`/api/audit/export?${p.toString()}`);
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url, { headers, credentials: token ? undefined : "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `audit-log-${days}d.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      snackbar.success("Audit log exported.");
    } catch {
      snackbar.error("Could not export audit log");
    } finally {
      setExporting(false);
    }
  }

  if (loading && items.length === 0 && !forbidden) {
    return <PageLoader minHeight="min-h-[40vh]" />;
  }

  if (forbidden) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold">Audit log access required</p>
        <p className="text-sm text-[var(--muted)] mt-2">
          Your role needs the <span className="font-mono text-xs">audit.read</span> permission to view this tab.
        </p>
      </Card>
    );
  }

  const statCards = stats
    ? [
        { label: "Events — 24h", value: formatCount(stats.events_24h) },
        { label: "Write actions", value: formatCount(stats.write_actions) },
        { label: "Admin", value: formatCount(stats.admin_events) },
        { label: "Auth", value: formatCount(stats.auth_events) },
        { label: "Security", value: formatCount(stats.security_events) },
      ]
    : [];

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle="See who did what and when across the school system."
        actions={
          <>
            <SelectField
              label=""
              options={[
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
              ]}
              value={days}
              onChange={(v) => setDays(v)}
              className="min-w-[8rem]"
            />
            <button
              type="button"
              className={btnSecondary}
              onClick={exportCsv}
              disabled={exporting || total === 0}
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {statCards.map((s) => (
          <Card key={s.label} className="py-3 px-4">
            <p className="text-[10px] uppercase text-[var(--muted)]">{s.label}</p>
            <p className="text-xl font-bold mt-1">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <input
          type="search"
          placeholder="Search user, action, resource…"
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
              tagFilter === t ? "bg-[var(--primary)] text-white border-transparent" : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {t}
          </button>
        ))}
        {loading && items.length > 0 && (
          <span className="text-xs text-[var(--muted)] ml-auto">Refreshing…</span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <Card className="p-0 overflow-hidden">
          {items.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-[var(--muted)]">
              No events in this period. Changes you make in settings will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-[var(--muted)] border-b bg-neutral-50/80">
                    <th className="text-left px-4 py-3">Time</th>
                    <th className="text-left px-4 py-3">Actor</th>
                    <th className="text-left px-4 py-3">What happened</th>
                    <th className="text-left px-4 py-3">Resource</th>
                    <th className="text-left px-4 py-3">IP</th>
                    <th className="text-left px-4 py-3">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={`border-b border-[var(--border)] cursor-pointer hover:bg-neutral-50 ${
                        selected?.id === e.id ? "bg-[var(--primary-light)]" : ""
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-mono text-xs">{e.time}</p>
                        <p className="text-[10px] text-[var(--muted)]">{e.date_label}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{e.actor}</p>
                        <p className="text-[10px] text-[var(--muted)]">{e.role ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{e.action_label}</p>
                        <p className="font-mono text-[10px] text-[var(--muted)] truncate max-w-[14rem]">{e.action}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[12rem] truncate" title={e.resource}>
                        {e.resource}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)] text-xs">{e.ip ?? "—"}</td>
                      <td className="px-4 py-3">
                        <TagPill tag={e.category} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] text-xs text-[var(--muted)]">
            <span>
              {total === 0
                ? "No matching events"
                : `Showing ${pageStart}–${pageEnd} of ${formatCount(total)}`}
            </span>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="self-center">
                  Page {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </Card>

        {selected ? (
          <div className="space-y-4">
            <Card>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-start gap-2 min-w-0">
                  <TagPill tag={selected.category} />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-snug">{selected.action_label}</p>
                    <p className="text-[10px] text-[var(--muted)] font-mono truncate">{selected.id}</p>
                    <p className="text-[10px] text-[var(--muted)] mt-0.5">
                      {selected.date_label} · {selected.time} UTC
                    </p>
                  </div>
                </div>
                <StatusBadge code={selected.status_code} />
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)] shrink-0">Actor</dt>
                  <dd className="text-right">{selected.actor}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)] shrink-0">Role</dt>
                  <dd className="text-right">{selected.role ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)] shrink-0">Resource</dt>
                  <dd className="text-right break-all">{selected.resource}</dd>
                </div>
                {selected.http_method && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--muted)] shrink-0">Request</dt>
                    <dd className="font-mono text-xs text-right">
                      {selected.http_method} {selected.path}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)] shrink-0">IP</dt>
                  <dd>{selected.ip ?? "—"}</dd>
                </div>
              </dl>
              {selected.changes.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[var(--border)]">
                  <p className="text-xs font-semibold mb-2">Details</p>
                  <ul className="text-xs space-y-1 text-[var(--muted)]">
                    {selected.changes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Card className="p-6 text-sm text-[var(--muted)] text-center">Select a row to see details</Card>
        )}
      </div>

      <Card className="mt-6 p-4">
        <h4 className="text-sm font-semibold mb-1">What appears here</h4>
        <p className="text-xs text-[var(--muted)]">
          Who signed in or out, when someone could not sign in, and when school data was added, changed, or removed
          (settings, fees, classes, students, and the rest). Browsing pages without saving is not listed here.
        </p>
      </Card>
    </>
  );
}
