"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary } from "@/lib/ui";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";

type Channel = { enabled: boolean; label: string; provider?: string };
type EventRow = {
  id: string;
  category: string;
  name: string;
  audience: string;
  channels: string[];
  enabled: boolean;
};

type Config = {
  channels: Record<string, Channel>;
  events: EventRow[];
};

const CHANNEL_KEYS = ["in_app", "email", "sms", "push", "whatsapp"] as const;

export function NotificationsTab({ token }: { token?: string | null }) {
  const snackbar = useSnackbar();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Config>("/api/settings/notifications", { token: token ?? undefined });
      setConfig(data);
    } catch {
      snackbar.error("Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, [token, snackbar]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const data = await api<Config>("/api/settings/notifications", {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify(config),
      });
      setConfig(data);
      snackbar.success("Notification settings saved.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(key: string) {
    if (!config) return;
    setConfig({
      ...config,
      channels: {
        ...config.channels,
        [key]: { ...config.channels[key], enabled: !config.channels[key]?.enabled },
      },
    });
  }

  function toggleEvent(id: string) {
    if (!config) return;
    setConfig({
      ...config,
      events: config.events.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)),
    });
  }

  const meta = TAB_META.notifications;

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        onSave={save}
        saving={saving}
        saveLabel="Save changes"
      />

      {loading || !config ? (
        <PageLoader minHeight="min-h-[12rem]" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {CHANNEL_KEYS.map((key) => {
              const ch = config.channels[key];
              if (!ch) return null;
              return (
                <Card key={key} className="py-3 px-4">
                  <p className="text-sm font-medium">{ch.label}</p>
                  {ch.provider && <p className="text-[10px] text-[var(--muted)] mt-0.5">{ch.provider}</p>}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ch.enabled}
                    onClick={() => toggleChannel(key)}
                    className={`mt-3 w-10 h-5 rounded-full relative ${ch.enabled ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white ${ch.enabled ? "left-5" : "left-0.5"}`} />
                  </button>
                </Card>
              );
            })}
          </div>

          <Card className="p-0 overflow-hidden">
            <p className="px-4 py-3 text-xs font-semibold text-[var(--muted)] border-b">Event delivery</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-[var(--muted)] border-b">
                    <th className="text-left px-4 py-3">Event</th>
                    <th className="text-left px-4 py-3">Audience</th>
                    <th className="text-left px-4 py-3">Channels</th>
                    <th className="text-left px-4 py-3">On</th>
                  </tr>
                </thead>
                <tbody>
                  {config.events.map((ev) => (
                    <tr key={ev.id} className="border-b border-[var(--border)]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{ev.name}</p>
                        <p className="text-[10px] text-[var(--muted)]">{ev.category}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{ev.audience}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {ev.channels.map((c) => (
                            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary-light)]">
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={ev.enabled}
                          onClick={() => toggleEvent(ev.id)}
                          className={`w-10 h-5 rounded-full relative ${ev.enabled ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white ${ev.enabled ? "left-5" : "left-0.5"}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mt-4 border-dashed">
            <p className="text-sm text-[var(--muted)]">Per-event templates and multi-language bodies — coming next.</p>
          </Card>
        </>
      )}
    </>
  );
}
