"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { Modal } from "@/components/ui/Modal";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";

type Permission = { id: string; code: string; description: string | null };
type Role = { id: string; name: string; description: string | null; is_system: boolean; permission_codes: string[] };
type UserRow = { id: string; email: string; full_name: string | null; is_superuser: boolean; role_names: string[] };

function groupPermissions(perms: Permission[]) {
  const groups: Record<string, Permission[]> = {};
  for (const p of perms) {
    const key = p.code.includes(".") ? p.code.split(".")[0] : "other";
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    if (!groups[label]) groups[label] = [];
    groups[label].push(p);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

const ROLE_COLORS: Record<string, string> = {
  teacher: "bg-neutral-900 text-white",
  principal: "bg-blue-100 text-blue-900",
  admin: "bg-amber-100 text-amber-900",
  accountant: "bg-rose-100 text-rose-900",
  student: "bg-sky-100 text-sky-900",
  guardian: "bg-neutral-100 text-neutral-600",
};

export function RolesSettingsTab({ token }: { token?: string | null }) {
  const { user, hasPermission } = useAuth();
  const snackbar = useSnackbar();
  const canManage = Boolean(user?.is_superuser || hasPermission("roles.manage"));

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [assignUserId, setAssignUserId] = useState("");
  const [saving, setSaving] = useState(false);

  const opts = { token: token ?? undefined };

  const load = useCallback(() => {
    Promise.all([
      api<Permission[]>("/api/rbac/permissions", opts),
      api<Role[]>("/api/rbac/roles", opts),
      api<UserRow[]>("/api/rbac/users", opts),
    ])
      .then(([p, r, u]) => {
        setPermissions(p);
        setRoles(r);
        setUsers(u);
        setSelectedRoleId((prev) => prev ?? r[0]?.id ?? null);
      })
      .catch(() => snackbar.error("Failed to load roles"));
  }, [token, snackbar]);

  useEffect(() => {
    if (!user?.is_superuser && !hasPermission("roles.read")) return;
    load();
  }, [user, hasPermission, load]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const permGroups = useMemo(() => groupPermissions(permissions), [permissions]);
  const usersWithRole = useMemo(
    () => users.filter((u) => selectedRole && u.role_names.includes(selectedRole.name)),
    [users, selectedRole]
  );

  function openCreate() {
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setSelectedPerms(new Set());
    setShowRoleForm(true);
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description ?? "");
    setSelectedPerms(new Set(role.permission_codes));
    setShowRoleForm(true);
  }

  function togglePerm(code: string) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      const body = {
        name: roleName.trim(),
        description: roleDesc || undefined,
        permission_codes: Array.from(selectedPerms),
      };
      if (editingRole) {
        await api(`/api/rbac/roles/${editingRole.id}`, { ...opts, method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/api/rbac/roles", { ...opts, method: "POST", body: JSON.stringify(body) });
      }
      setShowRoleForm(false);
      load();
      snackbar.success("Role saved.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function assignRolesToUser() {
    if (!canManage || !assignUserId || !selectedRole) return;
    const u = users.find((x) => x.id === assignUserId);
    if (!u) return;
    const roleIds = roles.filter((r) => u.role_names.includes(r.name) || r.id === selectedRole.id).map((r) => r.id);
    const unique = Array.from(new Set(roleIds));
    if (!unique.includes(selectedRole.id)) unique.push(selectedRole.id);
    await api(`/api/rbac/users/${assignUserId}/roles`, {
      ...opts,
      method: "PUT",
      body: JSON.stringify({ role_ids: unique }),
    });
    load();
    setAssignUserId("");
    snackbar.success("Role assigned.");
  }

  if (!user?.is_superuser && !hasPermission("roles.read")) {
    return <Card><p className="text-[var(--muted)]">You do not have permission to view roles.</p></Card>;
  }

  const meta = TAB_META.roles;

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          canManage ? (
            <button type="button" onClick={openCreate} className={btnPrimary}>
              + New role
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-6">
        <Card className="p-0 overflow-hidden xl:max-h-[640px]">
          <p className="px-4 py-3 text-xs font-semibold text-[var(--muted)] border-b">
            {roles.length} roles
          </p>
          <ul className="divide-y divide-[var(--border)] overflow-y-auto max-h-[560px]">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`w-full text-left px-4 py-3 ${selectedRoleId === r.id ? "bg-[var(--primary-light)]" : "hover:bg-neutral-50"}`}
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ROLE_COLORS[r.name.toLowerCase()] ?? "bg-neutral-100"}`}>
                    {r.name}
                  </span>
                  {r.is_system && <span className="ml-1 text-[10px] text-[var(--muted)]">system</span>}
                  <p className="text-[11px] text-[var(--muted)] mt-1">{r.permission_codes.length} permissions</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4 min-w-0">
          {selectedRole ? (
            <>
              <Card>
                <div className="flex flex-wrap justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold capitalize">{selectedRole.name}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {selectedRole.permission_codes.length} permissions · {usersWithRole.length} users
                      {selectedRole.is_system && " · system role"}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(selectedRole)} className={btnSecondary}>
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                  {permGroups.map(([group, perms]) => (
                    <div key={group}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
                        {group}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {perms.map((p) => {
                          const on = selectedRole.permission_codes.includes(p.code);
                          return (
                            <div
                              key={p.code}
                              className={`text-xs px-2 py-1.5 rounded border ${on ? "bg-[var(--primary-light)] border-[var(--border)]" : "opacity-40 border-transparent"}`}
                            >
                              <span className="font-mono">{p.code}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {canManage && (
                <Card>
                  <h4 className="text-sm font-semibold mb-3">Assign user to this role</h4>
                  <div className="flex gap-2">
                    <SelectField
                      className="flex-1"
                      options={users
                        .filter((u) => !u.is_superuser)
                        .map((u) => ({
                          value: u.id,
                          label: `${u.full_name || u.email} (${u.role_names.join(", ") || "none"})`,
                        }))}
                      value={assignUserId}
                      onChange={setAssignUserId}
                      placeholder="Select user"
                    />
                    <button type="button" onClick={assignRolesToUser} disabled={!assignUserId} className={btnPrimary}>
                      Assign
                    </button>
                  </div>
                  {usersWithRole.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {usersWithRole.slice(0, 12).map((u) => (
                        <span key={u.id} className="text-xs px-2 py-1 rounded-full bg-[var(--primary-light)]">
                          {u.full_name || u.email}
                        </span>
                      ))}
                      {usersWithRole.length > 12 && (
                        <span className="text-xs text-[var(--muted)]">+{usersWithRole.length - 12} more</span>
                      )}
                    </div>
                  )}
                </Card>
              )}
            </>
          ) : (
            <Card><p className="text-sm text-[var(--muted)]">Select a role.</p></Card>
          )}
        </div>
      </div>

      <Modal open={showRoleForm} onClose={() => setShowRoleForm(false)} title={editingRole ? "Edit role" : "Create role"} size="lg">
        <form onSubmit={saveRole} className="space-y-4">
          <input type="text" value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Role name" required className={inputClass} />
          <input type="text" value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} placeholder="Description" className={inputClass} />
          <div className="max-h-52 overflow-y-auto border rounded-xl p-3 space-y-3">
            {permGroups.map(([group, perms]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-[var(--muted)] mb-1">{group}</p>
                {perms.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                    <input type="checkbox" checked={selectedPerms.has(p.code)} onChange={() => togglePerm(p.code)} />
                    <span className="font-mono text-xs">{p.code}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowRoleForm(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
