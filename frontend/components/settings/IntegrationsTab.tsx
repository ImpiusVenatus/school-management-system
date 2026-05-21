"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";

type IntegrationStatus = "connected" | "available" | "pending";

type Integration = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: IntegrationStatus;
  meta?: string;
  filter: string;
};

const INTEGRATIONS: Integration[] = [
  { id: "razorpay", name: "Razorpay", category: "Payments", description: "UPI, cards, netbanking, EMI", status: "connected", meta: "rzp_live_••••4f2a", filter: "Payments" },
  { id: "postmark", name: "Postmark", category: "Email", description: "Transactional email delivery", status: "connected", meta: "Last send: 2 min ago", filter: "Email" },
  { id: "twilio", name: "Twilio SMS", category: "SMS", description: "OTP and guardian alerts", status: "connected", meta: "₹0.15/msg · India", filter: "SMS" },
  { id: "google", name: "Google Workspace", category: "SSO", description: "Staff sign-in with Google", status: "connected", meta: "14 classes synced", filter: "SSO" },
  { id: "entra", name: "Microsoft Entra", category: "SSO", description: "Azure AD for staff", status: "available", filter: "SSO" },
  { id: "classroom", name: "Google Classroom", category: "Academic", description: "Import courses & rosters", status: "connected", meta: "Last sync: 6h ago", filter: "Academic" },
  { id: "meet", name: "Google Meet", category: "Academic", description: "Auto-create meeting links", status: "available", filter: "Academic" },
  { id: "s3", name: "AWS S3 backups", category: "Storage", description: "Nightly DB & file exports", status: "connected", meta: "ap-south-1", filter: "Storage" },
  { id: "sentry", name: "Sentry", category: "Monitoring", description: "Error tracking for API & web", status: "connected", filter: "Monitoring" },
  { id: "bio", name: "Realtime Biometric", category: "Hardware", description: "Attendance fingerprint reader", status: "pending", meta: "Awaiting device IP", filter: "Hardware" },
  { id: "qb", name: "QuickBooks", category: "Finance", description: "Sync invoices & payments", status: "available", filter: "Finance" },
  { id: "whatsapp", name: "WhatsApp Business", category: "Comms", description: "Template messages to guardians", status: "pending", meta: "Verification in progress", filter: "Comms" },
];

const FILTERS = ["All", "Payments", "SMS", "Email", "SSO", "Academic", "Storage", "Monitoring", "Hardware", "Finance", "Comms"];

const API_KEYS = [
  { name: "ETL — reports nightly", key: "sk_live_••••8c2f", scope: "read", lastUsed: "Today 02:00" },
  { name: "Mobile guardian app", key: "sk_live_••••91ab", scope: "read", lastUsed: "2h ago" },
  { name: "Admissions form", key: "sk_live_••••3e44", scope: "write", lastUsed: "Yesterday" },
  { name: "Old principal script", key: "sk_live_••••ff01", scope: "admin", lastUsed: "Mar 12" },
];

const WEBHOOKS = [
  { url: "https://hooks.school.edu/payments", events: ["payments.created", "payments.failed"], status: "healthy", time: "09:41" },
  { url: "https://hooks.school.edu/admissions", events: ["admissions.applied"], status: "healthy", time: "08:12" },
  { url: "https://backup.vendor.io/ingest", events: ["backup.completed"], status: "degraded", time: "Yesterday" },
];

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const styles = {
    connected: "bg-emerald-50 text-emerald-800 border-emerald-200",
    available: "bg-neutral-100 text-neutral-600 border-[var(--border)]",
    pending: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${styles[status]}`}>
      {status === "connected" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />}
      {status}
    </span>
  );
}

export function IntegrationsTab() {
  const [filter, setFilter] = useState("All");
  const meta = TAB_META.integrations;

  const filtered = useMemo(() => {
    if (filter === "All") return INTEGRATIONS;
    return INTEGRATIONS.filter((i) => i.filter === filter);
  }, [filter]);

  const counts = useMemo(() => {
    const connected = INTEGRATIONS.filter((i) => i.status === "connected").length;
    const available = INTEGRATIONS.filter((i) => i.status === "available").length;
    const pending = INTEGRATIONS.filter((i) => i.status === "pending").length;
    return { connected, available, pending };
  }, []);

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle="Connect SMS, payments, identity, and storage. API keys stay on the server — backend wiring coming soon."
        actions={
          <>
            <button type="button" className={btnSecondary}>Browse marketplace</button>
            <button type="button" className={btnPrimary}>+ Custom webhook</button>
          </>
        }
      />

      <p className="text-sm text-[var(--muted)] mb-4">
        {counts.connected} connected · {counts.available} available · {counts.pending} pending
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filter === f ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {filtered.map((item) => (
          <Card key={item.id} className="relative flex flex-col">
            <div className="absolute top-4 right-4">
              <StatusBadge status={item.status} />
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] flex items-center justify-center text-sm font-bold mb-3">
              {item.name[0]}
            </div>
            <p className="font-semibold text-sm pr-16">{item.name}</p>
            <p className="text-[11px] text-[var(--muted)]">{item.category}</p>
            <p className="text-sm text-[var(--muted)] mt-2 flex-1">{item.description}</p>
            {item.meta && <p className="text-[11px] text-[var(--muted-light)] mt-2 font-mono">{item.meta}</p>}
            <div className="flex gap-2 mt-4 pt-3 border-t border-[var(--border)]">
              <button type="button" className={item.status === "connected" ? btnSecondary : btnPrimary}>
                {item.status === "connected" ? "Configure" : item.status === "pending" ? "View status" : "Connect"}
              </button>
              <button type="button" className="text-[var(--muted)] px-2" aria-label="More">
                ⋯
              </button>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold">API access</h3>
            <button type="button" className={btnSecondary}>+ New key</button>
          </div>
          <p className="text-xs text-[var(--muted)] mb-3">For your own scripts and tooling</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-[var(--muted)] border-b">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Key</th>
                  <th className="text-left py-2">Scope</th>
                  <th className="text-left py-2">Last used</th>
                </tr>
              </thead>
              <tbody>
                {API_KEYS.map((k) => (
                  <tr key={k.name} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 font-medium">{k.name}</td>
                    <td className="py-2.5 font-mono text-xs">{k.key}</td>
                    <td className="py-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary-light)]">{k.scope}</span>
                    </td>
                    <td className="py-2.5 text-[var(--muted)]">{k.lastUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold">Outgoing webhooks</h3>
            <button type="button" className={btnSecondary}>+ Webhook</button>
          </div>
          <p className="text-xs text-[var(--muted)] mb-4">3 endpoints · last 24h: 412 sent · 1 retry</p>
          <ul className="space-y-3">
            {WEBHOOKS.map((w) => (
              <li key={w.url} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs font-mono truncate">{w.url}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {w.events.map((e) => (
                    <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary-light)]">{e}</span>
                  ))}
                </div>
                <p className="text-[11px] mt-2 text-[var(--muted)]">
                  <span className={w.status === "healthy" ? "text-emerald-700" : "text-amber-700"}>{w.status}</span>
                  {" · "}{w.time}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
