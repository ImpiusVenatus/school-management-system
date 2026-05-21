"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SelectField } from "@/components/ui/SelectField";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api, getApiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";

type Permission = {
  id: string;
  code: string;
  description: string | null;
  group: string | null;
  action: string | null;
};

type Role = {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  is_system: boolean;
  scoped_to_assigned_sections: boolean;
  permission_codes: string[];
  user_count: number;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_superuser: boolean;
  role_names: string[];
};

const GROUP_ORDER = [
  "AUTH & USERS",
  "ACADEMIC STRUCTURE",
  "STUDENTS",
  "OPERATIONS",
  "ASSESSMENT",
  "FEES",
  "SYSTEM",
  "OTHER",
];

const ROLE_TAG_CLASS: Record<string, string> = {
  super_admin: "bg-neutral-900 text-white",
  principal: "bg-blue-100 text-blue-900",
  teacher: "bg-neutral-800 text-white",
  admin_staff: "bg-amber-100 text-amber-900",
  accountant: "bg-rose-100 text-rose-900",
  student: "bg-sky-100 text-sky-900",
  guardian: "bg-neutral-100 text-neutral-700",
  librarian: "bg-violet-100 text-violet-900",
};

const ACTION_STYLES: Record<string, string> = {
  R: "bg-sky-100 text-sky-800",
  C: "bg-emerald-100 text-emerald-800",
  U: "bg-amber-100 text-amber-800",
  D: "bg-red-100 text-red-800",
  M: "bg-violet-100 text-violet-800",
};

function groupPermissions(perms: Permission[]) {
  const groups: Record<string, Permission[]> = {};
  for (const p of perms) {
    const key = p.group || "OTHER";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => [g, groups[g]!] as const);
}

function snapshotRole(r: Role, permCodes: Set<string>): string {
  return JSON.stringify({
    name: r.name,
    display_name: r.display_name,
    description: r.description,
    scoped_to_assigned_sections: r.scoped_to_assigned_sections,
    permission_codes: Array.from(permCodes).sort(),
  });
}

export function RolesSettingsTab({ token }: { token?: string | null }) {
  const { user, hasPermission } = useAuth();
  const snackbar = useSnackbar();
  const canManage = Boolean(user?.is_superuser || hasPermission("roles.manage"));
  const opts = { token: token ?? undefined };

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleUsers, setRoleUsers] = useState<UserRow[]>([]);
  const [assignPool, setAssignPool] = useState<UserRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftScoped, setDraftScoped] = useState(false);
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set());
  const [baseline, setBaseline] = useState("");

  const [permSearch, setPermSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [newModal, setNewModal] = useState(false);
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");

  const loadRoleUsers = useCallback(
    async (roleId: string) => {
      try {
        const u = await api<UserRow[]>(`/api/rbac/users?role_id=${roleId}&limit=500`, opts);
        setRoleUsers(u);
      } catch {
        setRoleUsers([]);
      }
    },
    [token]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        api<Permission[]>("/api/rbac/permissions", opts),
        api<Role[]>("/api/rbac/roles", opts),
      ]);
      setPermissions(p);
      setRoles(r);
      setSelectedRoleId((prev) => (prev && r.some((x) => x.id === prev) ? prev : r[0]?.id ?? null));
    } catch {
      snackbar.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, [token, snackbar]);

  useEffect(() => {
    if (!user?.is_superuser && !hasPermission("roles.read")) return;
    load();
  }, [user, hasPermission, load]);

  useEffect(() => {
    if (!selectedRoleId) {
      setRoleUsers([]);
      return;
    }
    loadRoleUsers(selectedRoleId);
  }, [selectedRoleId, loadRoleUsers]);

  useEffect(() => {
    if (!canManage) return;
    api<UserRow[]>("/api/rbac/users?limit=200", opts)
      .then(setAssignPool)
      .catch(() => setAssignPool([]));
  }, [canManage, token]);

  const selected = roles.find((r) => r.id === selectedRoleId) ?? null;

  const syncDraftFromRole = useCallback((r: Role) => {
    const codes = new Set(r.permission_codes);
    setDraftName(r.name);
    setDraftDisplayName(r.display_name || r.name.replace(/_/g, " "));
    setDraftDesc(r.description ?? "");
    setDraftScoped(r.scoped_to_assigned_sections);
    setDraftPerms(codes);
    setBaseline(snapshotRole(r, codes));
  }, []);

  useEffect(() => {
    if (selected) syncDraftFromRole(selected);
  }, [selected?.id, syncDraftFromRole]);

  const isDirty = useMemo(() => {
    if (!selected) return false;
    return (
      baseline !==
      snapshotRole(
        {
          ...selected,
          name: draftName,
          display_name: draftDisplayName,
          description: draftDesc,
          scoped_to_assigned_sections: draftScoped,
        },
        draftPerms
      )
    );
  }, [selected, baseline, draftName, draftDisplayName, draftDesc, draftScoped, draftPerms]);

  const permGroups = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    const filtered = q
      ? permissions.filter(
          (p) =>
            p.code.toLowerCase().includes(q) ||
            (p.description || "").toLowerCase().includes(q)
        )
      : permissions;
    return groupPermissions(filtered);
  }, [permissions, permSearch]);

  const enabledCount = draftPerms.size;
  const totalPerms = permissions.length;

  const usersWithRole = useMemo(() => {
    if (!selected) return [];
    const q = userFilter.trim().toLowerCase();
    return roleUsers.filter((u) => {
      if (!q) return true;
      return (
        (u.full_name || "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [roleUsers, selected, userFilter]);

  const systemCount = roles.filter((r) => r.is_system).length;
  const customCount = roles.length - systemCount;

  function selectRole(id: string) {
    if (isDirty && id !== selectedRoleId) {
      if (!window.confirm("Discard unsaved changes to this role?")) return;
    }
    setSelectedRoleId(id);
    setPermSearch("");
    setUserFilter("");
  }

  function discardChanges() {
    if (selected) syncDraftFromRole(selected);
  }

  async function saveRole() {
    if (!selected || !canManage) return;
    setSaving(true);
    try {
      const updated = await api<Role>(`/api/rbac/roles/${selected.id}`, {
        ...opts,
        method: "PATCH",
        body: JSON.stringify({
          name: selected.is_system ? undefined : draftName.trim().toLowerCase().replace(/\s+/g, "_"),
          display_name: draftDisplayName.trim(),
          description: draftDesc || null,
          scoped_to_assigned_sections: draftScoped,
          permission_codes: Array.from(draftPerms),
        }),
      });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      syncDraftFromRole(updated);
      snackbar.success("Role saved. Changes apply on next login.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function togglePerm(code: string) {
    setDraftPerms((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleGroup(perms: Permission[], enable: boolean) {
    setDraftPerms((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (enable) next.add(p.code);
        else next.delete(p.code);
      }
      return next;
    });
  }

  function toggleAllPerms(enable: boolean) {
    setDraftPerms(enable ? new Set(permissions.map((p) => p.code)) : new Set());
  }

  async function duplicateRole() {
    if (!selected || !canManage) return;
    setSaving(true);
    try {
      const dup = await api<Role>(`/api/rbac/roles/${selected.id}/duplicate`, {
        ...opts,
        method: "POST",
      });
      setRoles((prev) => [...prev, dup]);
      setSelectedRoleId(dup.id);
      snackbar.success("Role duplicated.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteRole() {
    if (!deleteRoleId || !canManage) return;
    setSaving(true);
    try {
      await api(`/api/rbac/roles/${deleteRoleId}`, { ...opts, method: "DELETE" });
      setRoles((prev) => prev.filter((r) => r.id !== deleteRoleId));
      setSelectedRoleId((prev) => (prev === deleteRoleId ? null : prev));
      setDeleteRoleId(null);
      snackbar.success("Role deleted.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Cannot delete role");
    } finally {
      setSaving(false);
    }
  }

  async function exportYaml() {
    try {
      const res = await fetch(getApiUrl("/api/rbac/roles/export"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "roles-export.yaml";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      snackbar.error("Export failed");
    }
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      const created = await api<Role>("/api/rbac/roles", {
        ...opts,
        method: "POST",
        body: JSON.stringify({
          name: newRoleKey.trim().toLowerCase().replace(/\s+/g, "_"),
          display_name: newDisplayName.trim() || newRoleKey.trim(),
          description: "",
          permission_codes: [],
        }),
      });
      setRoles((prev) => [...prev, created]);
      setSelectedRoleId(created.id);
      setNewModal(false);
      snackbar.success("Role created.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  async function assignUser() {
    if (!selected || !assignUserId || !canManage) return;
    const u = assignPool.find((x) => x.id === assignUserId);
    if (!u) return;
    const roleIds = roles.filter((r) => u.role_names.includes(r.name) || r.id === selected.id).map((r) => r.id);
    const unique = Array.from(new Set(roleIds.includes(selected.id) ? roleIds : [...roleIds, selected.id]));
    try {
      await api(`/api/rbac/users/${assignUserId}/roles`, {
        ...opts,
        method: "PUT",
        body: JSON.stringify({ role_ids: unique }),
      });
      await loadRoleUsers(selected.id);
      const pool = await api<UserRow[]>("/api/rbac/users?limit=200", opts);
      setAssignPool(pool);
      setAssignUserId("");
      snackbar.success("User assigned.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Assign failed");
    }
  }

  async function removeUserFromRole(userId: string) {
    if (!selected || !canManage) return;
    try {
      await api(`/api/rbac/roles/${selected.id}/users/${userId}`, { ...opts, method: "DELETE" });
      await loadRoleUsers(selected.id);
      snackbar.success("User removed from role.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  if (!user?.is_superuser && !hasPermission("roles.read")) {
    return (
      <Card>
        <p className="text-[var(--muted)]">You do not have permission to view roles.</p>
      </Card>
    );
  }

  const meta = TAB_META.roles;
  const displayTitle = selected?.display_name || selected?.name || "";

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          canManage ? (
            <>
              <button type="button" onClick={exportYaml} className={btnSecondary}>
                Export YAML
              </button>
              <button type="button" onClick={() => setNewModal(true)} className={btnPrimary}>
                + New role
              </button>
            </>
          ) : undefined
        }
      />

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
          <Card className="p-0 overflow-hidden h-fit border border-[var(--border)] shadow-sm">
            <div className="px-4 pt-2 pb-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Roles{" "}
                <span className="font-normal text-[var(--muted-light)] tabular-nums">
                  {roles.length}
                </span>
              </span>
              <p className="text-[10px] font-mono text-[var(--muted-light)] mt-0.5">
                {systemCount} system · {customCount} custom
              </p>
            </div>
            <div className="border-b border-[var(--border)]" role="presentation" />
            <ul className="pt-1 max-h-[640px] overflow-y-auto">
              {roles.map((r) => {
                const active = r.id === selectedRoleId;
                const tagClass = ROLE_TAG_CLASS[r.name] ?? "bg-neutral-100 text-neutral-800";
                return (
                  <li key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <button
                      type="button"
                      onClick={() => selectRole(r.id)}
                      className={`cursor-pointer w-full text-left py-3.5 pr-4 pl-3 transition-colors border-l-4 ${
                        active
                          ? "bg-[#f7f4ef] border-l-neutral-900"
                          : "border-l-transparent hover:bg-neutral-50/90"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tagClass}`}>
                          {r.name}
                        </span>
                        {r.is_system && (
                          <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--muted)]">
                            system
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-[var(--muted)] mt-2">
                        {r.permission_codes.length} perms · {r.user_count} users
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected ? (
            <div className="space-y-4 min-w-0">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold capitalize">{displayTitle}</h3>
                      {selected.is_system && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                          system role
                        </span>
                      )}
                      {selected.is_system && (
                        <span className="text-xs text-[var(--muted)]">cannot be deleted</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {enabledCount} / {totalPerms} permissions · {selected.user_count} users
                      {isDirty && (
                        <span className="ml-2 text-amber-700 font-medium">Unsaved changes</span>
                      )}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      {isDirty && (
                        <>
                          <button type="button" onClick={discardChanges} className={btnSecondary}>
                            Discard
                          </button>
                          <button type="button" onClick={saveRole} disabled={saving} className={btnPrimary}>
                            {saving ? "Saving…" : "Save changes"}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={duplicateRole}
                        disabled={saving || isDirty}
                        className={btnSecondary}
                      >
                        Duplicate
                      </button>
                      {!selected.is_system && (
                        <button
                          type="button"
                          onClick={() => setDeleteRoleId(selected.id)}
                          disabled={isDirty}
                          className="cursor-pointer p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
                          aria-label="Delete role"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={labelClass}>Role key</label>
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      disabled={!canManage || selected.is_system}
                      className={`${inputClass} font-mono text-sm disabled:opacity-60`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Display name</label>
                    <input
                      type="text"
                      value={draftDisplayName}
                      onChange={(e) => setDraftDisplayName(e.target.value)}
                      disabled={!canManage}
                      className={`${inputClass} disabled:opacity-60`}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                    disabled={!canManage}
                    rows={2}
                    className={`${inputClass} resize-y disabled:opacity-60`}
                  />
                </div>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftScoped}
                    onChange={(e) => setDraftScoped(e.target.checked)}
                    disabled={!canManage}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Scoped to assigned sections only</span>
                    <span className="block text-xs text-[var(--muted)] mt-0.5">
                      Own permissions are filtered by the teacher&apos;s assigned sections. Disabling makes
                      the role school-wide.
                    </span>
                  </span>
                </label>
              </Card>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h4 className="text-sm font-semibold">
                    Permission matrix{" "}
                    <span className="font-normal text-[var(--muted)]">
                      {enabledCount} of {totalPerms} enabled
                    </span>
                  </h4>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="search"
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder="Search permissions…"
                      className={`${inputClass} w-48 py-1.5 text-sm`}
                    />
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => toggleAllPerms(enabledCount < totalPerms)}
                        className={`${btnSecondary} text-xs py-1.5`}
                      >
                        {enabledCount >= totalPerms ? "Disable all" : "Enable all"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-5 max-h-[420px] overflow-y-auto pr-1">
                  {permGroups.map(([group, perms]) => {
                    const groupEnabled = perms.every((p) => draftPerms.has(p.code));
                    return (
                      <div key={group}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                            {group}
                          </p>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => toggleGroup(perms, !groupEnabled)}
                              className="text-[10px] text-[var(--primary)] hover:underline"
                            >
                              {groupEnabled ? "Disable group" : "Enable group"}
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {perms.map((p) => {
                            const on = draftPerms.has(p.code);
                            const letter = p.action;
                            return (
                              <label
                                key={p.code}
                                className={`flex items-center gap-2 text-xs px-2 py-2 rounded-lg border cursor-pointer transition-colors ${
                                  on
                                    ? "bg-emerald-50/80 border-emerald-200"
                                    : "border-transparent opacity-50 hover:opacity-80"
                                } ${!canManage ? "pointer-events-none" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => togglePerm(p.code)}
                                  disabled={!canManage}
                                  className="shrink-0"
                                />
                                <span className="font-mono truncate flex-1">{p.code}</span>
                                {letter && (
                                  <span
                                    className={`shrink-0 text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded ${
                                      ACTION_STYLES[letter] ?? "bg-neutral-100"
                                    }`}
                                  >
                                    {letter}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[10px] text-[var(--muted)] mt-4 pt-3 border-t border-[var(--border)]">
                  <span className="font-semibold">R</span> read · <span className="font-semibold">C</span>{" "}
                  create · <span className="font-semibold">U</span> update ·{" "}
                  <span className="font-semibold">M</span> manage · <span className="font-semibold">D</span>{" "}
                  destructive — changes effective on next login.
                </p>
              </Card>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h4 className="text-sm font-semibold">
                    Users with this role{" "}
                    <span className="text-[var(--muted)] font-normal">{usersWithRole.length}</span>
                  </h4>
                  {canManage && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        type="search"
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        placeholder="Filter…"
                        className={`${inputClass} w-36 py-1.5 text-sm`}
                      />
                      <SelectField
                        className="w-48"
                        options={assignPool
                          .filter((u) => !u.is_superuser && !u.role_names.includes(selected.name))
                          .map((u) => ({
                            value: u.id,
                            label: u.full_name || u.email,
                          }))}
                        value={assignUserId}
                        onChange={setAssignUserId}
                        placeholder="Assign user…"
                      />
                      <button
                        type="button"
                        onClick={assignUser}
                        disabled={!assignUserId}
                        className={`${btnSecondary} text-xs py-1.5`}
                      >
                        Assign users
                      </button>
                    </div>
                  )}
                </div>
                {usersWithRole.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No users assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {usersWithRole.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1.5 text-xs pl-2.5 pr-1 py-1 rounded-full bg-[var(--primary-light)] border border-[var(--border)]"
                      >
                        <span className="w-5 h-5 rounded-full bg-neutral-300 text-[9px] font-bold flex items-center justify-center text-white">
                          {(u.full_name || u.email).charAt(0).toUpperCase()}
                        </span>
                        {u.full_name || u.email}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => removeUserFromRole(u.id)}
                            className="cursor-pointer ml-0.5 w-5 h-5 rounded-full hover:bg-red-100 text-[var(--muted)] hover:text-red-700 flex items-center justify-center"
                            aria-label={`Remove ${u.full_name || u.email}`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card>
              <p className="text-sm text-[var(--muted)]">Select a role.</p>
            </Card>
          )}
        </div>
      )}

      <Modal open={newModal} onClose={() => !saving && setNewModal(false)} title="New role" size="md">
        <form onSubmit={createRole} className="space-y-4">
          <div>
            <label className={labelClass}>Role key</label>
            <input
              type="text"
              required
              value={newRoleKey}
              onChange={(e) => setNewRoleKey(e.target.value)}
              placeholder="e.g. lab_assistant"
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className={labelClass}>Display name</label>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Lab Assistant"
              className={inputClass}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setNewModal(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteRoleId !== null}
        onClose={() => setDeleteRoleId(null)}
        onConfirm={confirmDeleteRole}
        title="Delete role?"
        confirmLabel="Delete role"
        cancelLabel="Keep role"
        variant="danger"
        loading={saving}
      >
        <p>
          Deleting this role removes it from all assigned users. Users may lose access until you assign a
          different role. This cannot be undone.
        </p>
      </ConfirmModal>
    </>
  );
}
