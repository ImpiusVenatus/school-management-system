"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";
import { PageLoader, PulsingDots } from "@/components/ui/PulsingDotsLoader";

type Club = { id: string; name: string; description: string | null; academic_year_id: string | null; is_active: boolean };
type Moderator = { id: string; instructor_id: string; instructor_name: string | null; is_chief: boolean; academic_year_id: string };
type Member = { id: string; student_id: string; student_name: string | null; role_id: string | null; role_name: string; academic_year_id: string };
type Post = { id: string; title: string; body: string | null; created_at: string | null };
type ClubRole = { id: string; club_id: string; academic_year_id: string; name: string; rank: number; is_unique: boolean };
type YearOpt = { id: string; academic_year_name: string };
type InstructorOpt = { id: string; instructor_name: string };
type StudentOpt = { id: string; student_name: string };

export default function ClubDetailPage() {
  const params = useParams();
  const { token, hasPermission, loading: authLoading } = useAuth();
  const snackbar = useSnackbar();
  const id = params.id as string;
  const [club, setClub] = useState<Club | null>(null);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [roles, setRoles] = useState<ClubRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [years, setYears] = useState<YearOpt[]>([]);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubDesc, setClubDesc] = useState("");
  const [clubActive, setClubActive] = useState(true);

  const [modOpen, setModOpen] = useState(false);
  const [modSaving, setModSaving] = useState(false);
  const [instructors, setInstructors] = useState<InstructorOpt[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [modYearId, setModYearId] = useState("");
  const [isChief, setIsChief] = useState(false);

  const [memberOpen, setMemberOpen] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [memberYearId, setMemberYearId] = useState("");
  const [memberRoleId, setMemberRoleId] = useState<string>("");

  const [roleOpen, setRoleOpen] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleUnique, setRoleUnique] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignMember, setAssignMember] = useState<Member | null>(null);
  const [assignRoleId, setAssignRoleId] = useState<string>("");

  const [postOpen, setPostOpen] = useState(false);
  const [postSaving, setPostSaving] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");

  const canManage = hasPermission("clubs.manage");

  async function reloadRoles(nextYearId?: string) {
    const y = (nextYearId ?? yearFilter).trim();
    if (authLoading || !id || !canManage || !y) {
      setRoles([]);
      return;
    }
    setRolesLoading(true);
    try {
      const rows = await api<ClubRole[]>(`/api/clubs/${id}/roles?academic_year_id=${encodeURIComponent(y)}`, { token: token ?? undefined });
      setRoles(Array.isArray(rows) ? rows : []);
    } catch {
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !id) return;
    api<Club>("/api/clubs/" + id, { token: token ?? undefined })
      .then((c) => {
        setClub(c);
        setClubName(c.name);
        setClubDesc(c.description ?? "");
        setClubActive(!!c.is_active);
        if (!yearFilter && c.academic_year_id) setYearFilter(c.academic_year_id);
      })
      .catch(() => setClub(null));
  }, [token, authLoading, id, yearFilter]);

  useEffect(() => {
    if (authLoading) return;
    api<any[]>("/api/academic/years?include_counts=false", { token: token ?? undefined })
      .then((rows) => {
        const list: YearOpt[] = (rows || []).map((r: any) => ({
          id: r.id,
          academic_year_name: r.academic_year_name,
        }));
        setYears(list);
      })
      .catch(() => setYears([]));
  }, [token, authLoading]);

  useEffect(() => {
    if (authLoading || !id) return;
    const q = yearFilter ? "?academic_year_id=" + encodeURIComponent(yearFilter) : "";
    Promise.all([
      api<Moderator[]>("/api/clubs/" + id + "/moderators" + q, { token: token ?? undefined }).catch(() => []),
      api<Member[]>("/api/clubs/" + id + "/members" + q, { token: token ?? undefined }).catch(() => []),
      api<Post[]>("/api/clubs/" + id + "/posts" + q, { token: token ?? undefined }).catch(() => []),
    ]).then(([m, mb, p]) => {
      setModerators(Array.isArray(m) ? m : []);
      setMembers(Array.isArray(mb) ? mb : []);
      setPosts(Array.isArray(p) ? p : []);
    }).finally(() => setLoading(false));
  }, [token, authLoading, id, yearFilter]);

  useEffect(() => {
    reloadRoles();
  }, [token, authLoading, id, yearFilter, canManage]);

  const yearOptions = useMemo(() => [{ value: "", label: "All years" }, ...years.map((y) => ({ value: y.id, label: y.academic_year_name }))], [years]);

  async function refreshAll() {
    if (!id) return;
    setLoading(true);
    const q = yearFilter ? "?academic_year_id=" + encodeURIComponent(yearFilter) : "";
    try {
      const [m, mb, p] = await Promise.all([
        api<Moderator[]>("/api/clubs/" + id + "/moderators" + q, { token: token ?? undefined }).catch(() => []),
        api<Member[]>("/api/clubs/" + id + "/members" + q, { token: token ?? undefined }).catch(() => []),
        api<Post[]>("/api/clubs/" + id + "/posts" + q, { token: token ?? undefined }).catch(() => []),
      ]);
      setModerators(Array.isArray(m) ? m : []);
      setMembers(Array.isArray(mb) ? mb : []);
      setPosts(Array.isArray(p) ? p : []);
    } finally {
      setLoading(false);
    }
  }

  async function openAddModerator() {
    setSelectedInstructorId("");
    setModYearId(yearFilter || "");
    setIsChief(false);
    setModOpen(true);
    if (instructors.length === 0) {
      setInstructorsLoading(true);
      try {
        const rows = await api<any[]>("/api/instructors?limit=500", { token: token ?? undefined });
        setInstructors((rows || []).map((r: any) => ({ id: r.id, instructor_name: r.instructor_name })));
      } catch {
        setInstructors([]);
      } finally {
        setInstructorsLoading(false);
      }
    }
  }

  async function openAddMember() {
    setSelectedStudentId("");
    setStudentSearch("");
    setStudents([]);
    setMemberYearId(yearFilter || "");
    setMemberRoleId("");
    setMemberOpen(true);
  }

  async function searchStudents() {
    const q = studentSearch.trim();
    if (!q) return;
    setStudentsLoading(true);
    try {
      const rows = await api<any[]>(`/api/students?limit=30&search=${encodeURIComponent(q)}`, { token: token ?? undefined });
      setStudents((rows || []).map((r: any) => ({ id: r.id, student_name: r.student_name })));
    } catch {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }

  if (!club) return <div className="text-gray-500">Club not found. <Link href="/dashboard/clubs" className="text-[var(--foreground)] font-medium">Back</Link></div>;

  const roleOptions = [{ value: "", label: "Member" }, ...roles.map((r) => ({ value: r.id, label: r.name }))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/clubs" className="text-sm text-[var(--muted)] hover:underline">
            ← Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
            {club.description && <p className="text-sm text-[var(--muted)]">{club.description}</p>}
          </div>
        </div>
        {canManage && (
          <button type="button" className={btnSecondary} onClick={() => setEditOpen(true)}>
            Edit club
          </button>
        )}
      </div>

      <div className="flex gap-2 items-center">
        <SelectField label="Academic year" options={yearOptions} value={yearFilter} onChange={setYearFilter} className="max-w-xs" />
      </div>

      {canManage && (
        <Card>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Officer roles</h2>
              <p className="text-xs text-[var(--muted)]">Define titles like President, VP, GS, etc. (per academic year).</p>
            </div>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                if (!yearFilter) {
                  snackbar.error("Select an academic year first.");
                  return;
                }
                setRoleName("");
                setRoleUnique(false);
                setRoleOpen(true);
              }}
            >
              + Add role
            </button>
          </div>

          {!yearFilter ? (
            <p className="text-sm text-[var(--muted)]">Select an academic year to manage roles.</p>
          ) : rolesLoading ? (
            <div className="py-6 flex justify-center">
              <PulsingDots />
            </div>
          ) : roles.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No roles yet. Add President/VP/GS, etc.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)]">
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Unique</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r, idx) => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-[var(--muted)]">Rank {r.rank}</p>
                      </td>
                      <td className="py-3">
                        {r.is_unique ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                            Unique
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-50 text-neutral-600 border border-neutral-200">
                            Multiple
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={idx === 0}
                            onClick={async () => {
                              const prev = roles[idx - 1];
                              if (!prev) return;
                              try {
                                await api(`/api/clubs/roles/${r.id}`, {
                                  token: token ?? undefined,
                                  method: "PATCH",
                                  body: JSON.stringify({ rank: prev.rank }),
                                });
                                await api(`/api/clubs/roles/${prev.id}`, {
                                  token: token ?? undefined,
                                  method: "PATCH",
                                  body: JSON.stringify({ rank: r.rank }),
                                });
                                reloadRoles();
                              } catch (err) {
                                snackbar.error(err instanceof Error ? err.message : "Failed to reorder");
                              }
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={idx === roles.length - 1}
                            onClick={async () => {
                              const next = roles[idx + 1];
                              if (!next) return;
                              try {
                                await api(`/api/clubs/roles/${r.id}`, {
                                  token: token ?? undefined,
                                  method: "PATCH",
                                  body: JSON.stringify({ rank: next.rank }),
                                });
                                await api(`/api/clubs/roles/${next.id}`, {
                                  token: token ?? undefined,
                                  method: "PATCH",
                                  body: JSON.stringify({ rank: r.rank }),
                                });
                                reloadRoles();
                              } catch (err) {
                                snackbar.error(err instanceof Error ? err.message : "Failed to reorder");
                              }
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={async () => {
                              const nextName = prompt("Rename role", r.name);
                              if (nextName == null) return;
                              if (!nextName.trim()) {
                                snackbar.error("Role name cannot be empty.");
                                return;
                              }
                              try {
                                await api(`/api/clubs/roles/${r.id}`, {
                                  token: token ?? undefined,
                                  method: "PATCH",
                                  body: JSON.stringify({ name: nextName.trim() }),
                                });
                                reloadRoles();
                              } catch (err) {
                                snackbar.error(err instanceof Error ? err.message : "Failed to rename");
                              }
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={async () => {
                              try {
                                await api(`/api/clubs/roles/${r.id}`, {
                                  token: token ?? undefined,
                                  method: "PATCH",
                                  body: JSON.stringify({ is_unique: !r.is_unique }),
                                });
                                reloadRoles();
                              } catch (err) {
                                snackbar.error(err instanceof Error ? err.message : "Failed to update");
                              }
                            }}
                          >
                            {r.is_unique ? "Make multiple" : "Make unique"}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                            onClick={async () => {
                              if (!confirm("Delete this role?")) return;
                              try {
                                await api(`/api/clubs/roles/${r.id}`, { token: token ?? undefined, method: "DELETE" });
                                snackbar.success("Role deleted.");
                                reloadRoles();
                              } catch (err) {
                                snackbar.error(err instanceof Error ? err.message : "Failed to delete");
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Moderators</h2>
            {canManage && (
              <button type="button" className={btnSecondary} onClick={openAddModerator}>
                + Add
              </button>
            )}
          </div>
          {loading ? (
            <div className="py-6 flex justify-center">
              <PulsingDots />
            </div>
          ) : moderators.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No moderators.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {moderators.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.instructor_name ?? m.instructor_id}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {m.academic_year_id} {m.is_chief ? "· Chief" : ""}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      className="text-xs text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                      onClick={async () => {
                        if (!confirm("Remove moderator?")) return;
                        try {
                          await api(`/api/clubs/moderators/${m.id}`, { token: token ?? undefined, method: "DELETE" });
                          snackbar.success("Moderator removed.");
                          refreshAll();
                        } catch (err) {
                          snackbar.error(err instanceof Error ? err.message : "Failed to remove");
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Members</h2>
            {canManage && (
              <button type="button" className={btnSecondary} onClick={openAddMember}>
                + Add
              </button>
            )}
          </div>
          {loading ? (
            <div className="py-6 flex justify-center">
              <PulsingDots />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No members.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.student_name ?? m.student_id}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {m.academic_year_id} · {m.role_name}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={async () => {
                        setAssignMember(m);
                        setAssignRoleId(m.role_id ?? "");
                        setAssignOpen(true);
                      }}
                    >
                      Change role
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Posts</h2>
          {canManage && (
            <button type="button" className={btnPrimary} onClick={() => setPostOpen(true)}>
              + New post
            </button>
          )}
        </div>
        {loading ? (
          <PageLoader minHeight="min-h-[10rem]" />
        ) : posts.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No posts.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{p.title}</p>
                    {p.body && <p className="text-sm text-[var(--muted)] mt-1 whitespace-pre-wrap">{p.body}</p>}
                    <p className="text-xs text-[var(--muted)] mt-2">
                      {p.created_at ? new Date(p.created_at).toLocaleString() : ""}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      className="text-xs text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                      onClick={async () => {
                        if (!confirm("Delete this post?")) return;
                        try {
                          await api(`/api/clubs/posts/${p.id}`, { token: token ?? undefined, method: "DELETE" });
                          snackbar.success("Post deleted.");
                          refreshAll();
                        } catch (err) {
                          snackbar.error(err instanceof Error ? err.message : "Failed to delete");
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={editOpen} onClose={() => !editSaving && setEditOpen(false)} title="Edit club" size="md">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setEditSaving(true);
            try {
              const updated = await api<Club>(`/api/clubs/${club.id}`, {
                token: token ?? undefined,
                method: "PATCH",
                body: JSON.stringify({ name: clubName.trim(), description: clubDesc.trim() || null, is_active: clubActive }),
              });
              setClub(updated);
              snackbar.success("Club updated.");
              setEditOpen(false);
            } catch (err) {
              snackbar.error(err instanceof Error ? err.message : "Failed to save");
            } finally {
              setEditSaving(false);
            }
          }}
        >
          <div>
            <label className={labelClass}>Name</label>
            <input value={clubName} onChange={(e) => setClubName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={clubDesc} onChange={(e) => setClubDesc(e.target.value)} className={`${inputClass} min-h-[90px]`} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={clubActive} onChange={(e) => setClubActive(e.target.checked)} />
            Active
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" className={btnSecondary} onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={modOpen} onClose={() => !modSaving && setModOpen(false)} title="Add moderator" size="md">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedInstructorId || !modYearId) {
              snackbar.error("Instructor and academic year are required.");
              return;
            }
            setModSaving(true);
            try {
              await api("/api/clubs/moderators", {
                token: token ?? undefined,
                method: "POST",
                body: JSON.stringify({ club_id: club.id, instructor_id: selectedInstructorId, is_chief: isChief, academic_year_id: modYearId }),
              });
              snackbar.success("Moderator added.");
              setModOpen(false);
              refreshAll();
            } catch (err) {
              snackbar.error(err instanceof Error ? err.message : "Failed to add moderator");
            } finally {
              setModSaving(false);
            }
          }}
        >
          {instructorsLoading ? (
            <div className="py-6 flex justify-center">
              <PulsingDots />
            </div>
          ) : (
            <SelectField
              label="Instructor"
              value={selectedInstructorId}
              onChange={setSelectedInstructorId}
              options={[
                { value: "", label: "Select instructor" },
                ...instructors.map((i) => ({ value: i.id, label: i.instructor_name })),
              ]}
            />
          )}
          <SelectField label="Academic year" value={modYearId} onChange={setModYearId} options={yearOptions.filter((o) => o.value !== "")} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isChief} onChange={(e) => setIsChief(e.target.checked)} />
            Chief moderator
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" className={btnSecondary} onClick={() => setModOpen(false)} disabled={modSaving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={modSaving}>
              {modSaving ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={memberOpen} onClose={() => !memberSaving && setMemberOpen(false)} title="Add member" size="md">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedStudentId || !memberYearId) {
              snackbar.error("Student and academic year are required.");
              return;
            }
            setMemberSaving(true);
            try {
              await api("/api/clubs/members", {
                token: token ?? undefined,
                method: "POST",
                body: JSON.stringify({ club_id: club.id, student_id: selectedStudentId, role_id: memberRoleId || null, role_name: memberRoleId ? null : "member", academic_year_id: memberYearId }),
              });
              snackbar.success("Member added.");
              setMemberOpen(false);
              refreshAll();
            } catch (err) {
              snackbar.error(err instanceof Error ? err.message : "Failed to add member");
            } finally {
              setMemberSaving(false);
            }
          }}
        >
          <div>
            <label className={labelClass}>Find student</label>
            <div className="flex gap-2">
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className={inputClass}
                placeholder="Search by name…"
              />
              <button type="button" className={btnSecondary} onClick={searchStudents} disabled={studentsLoading}>
                {studentsLoading ? "…" : "Search"}
              </button>
            </div>
          </div>
          <SelectField
            label="Student"
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            options={[
              { value: "", label: "Select student" },
              ...students.map((s) => ({ value: s.id, label: s.student_name })),
            ]}
          />
          <SelectField label="Academic year" value={memberYearId} onChange={setMemberYearId} options={yearOptions.filter((o) => o.value !== "")} />
          <SelectField
            label="Role"
            value={memberRoleId}
            onChange={setMemberRoleId}
            options={roleOptions}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" className={btnSecondary} onClick={() => setMemberOpen(false)} disabled={memberSaving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={memberSaving}>
              {memberSaving ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={assignOpen} onClose={() => !assignSaving && setAssignOpen(false)} title="Assign role" size="sm">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!assignMember) return;
            setAssignSaving(true);
            try {
              await api(`/api/clubs/members/${assignMember.id}`, {
                token: token ?? undefined,
                method: "PATCH",
                body: JSON.stringify({ role_id: assignRoleId || null, role_name: assignRoleId ? null : "member" }),
              });
              snackbar.success("Role updated.");
              setAssignOpen(false);
              refreshAll();
            } catch (err) {
              snackbar.error(err instanceof Error ? err.message : "Failed to update role");
            } finally {
              setAssignSaving(false);
            }
          }}
        >
          <div className="text-sm text-[var(--muted)]">
            {assignMember?.student_name ?? assignMember?.student_id}
          </div>
          <SelectField label="Role" value={assignRoleId} onChange={setAssignRoleId} options={roleOptions} />
          <div className="flex gap-2 justify-end">
            <button type="button" className={btnSecondary} onClick={() => setAssignOpen(false)} disabled={assignSaving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={assignSaving}>
              {assignSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={roleOpen} onClose={() => !roleSaving && setRoleOpen(false)} title="Add role" size="sm">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!yearFilter) {
              snackbar.error("Select an academic year first.");
              return;
            }
            if (!roleName.trim()) {
              snackbar.error("Role name is required.");
              return;
            }
            setRoleSaving(true);
            try {
              const maxRank = roles.reduce((m, r) => Math.max(m, r.rank), 0);
              await api(`/api/clubs/${club.id}/roles`, {
                token: token ?? undefined,
                method: "POST",
                body: JSON.stringify({
                  academic_year_id: yearFilter,
                  name: roleName.trim(),
                  rank: maxRank + 1,
                  is_unique: roleUnique,
                }),
              });
              snackbar.success("Role created.");
              setRoleOpen(false);
              reloadRoles();
            } catch (err) {
              snackbar.error(err instanceof Error ? err.message : "Failed to create role");
            } finally {
              setRoleSaving(false);
            }
          }}
        >
          <div>
            <label className={labelClass}>Role name</label>
            <input value={roleName} onChange={(e) => setRoleName(e.target.value)} className={inputClass} placeholder="President" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={roleUnique} onChange={(e) => setRoleUnique(e.target.checked)} />
            Unique (only one member can hold it)
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" className={btnSecondary} onClick={() => setRoleOpen(false)} disabled={roleSaving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={roleSaving}>
              {roleSaving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={postOpen} onClose={() => !postSaving && setPostOpen(false)} title="New post" size="md">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!postTitle.trim()) {
              snackbar.error("Title is required.");
              return;
            }
            setPostSaving(true);
            try {
              await api("/api/clubs/posts", {
                token: token ?? undefined,
                method: "POST",
                body: JSON.stringify({ club_id: club.id, title: postTitle.trim(), body: postBody.trim() || null, academic_year_id: yearFilter || null }),
              });
              snackbar.success("Post created.");
              setPostOpen(false);
              setPostTitle("");
              setPostBody("");
              refreshAll();
            } catch (err) {
              snackbar.error(err instanceof Error ? err.message : "Failed to create post");
            } finally {
              setPostSaving(false);
            }
          }}
        >
          <div>
            <label className={labelClass}>Title</label>
            <input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Body</label>
            <textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} className={`${inputClass} min-h-[120px]`} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className={btnSecondary} onClick={() => setPostOpen(false)} disabled={postSaving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={postSaving}>
              {postSaving ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
