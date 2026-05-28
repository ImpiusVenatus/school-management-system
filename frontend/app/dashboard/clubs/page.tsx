"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";

type Club = { id: string; name: string; description: string | null; academic_year_id: string | null; is_active: boolean };
type YearOpt = { id: string; academic_year_name: string };
type InstructorOpt = { id: string; instructor_name: string };

const DEFAULT_ROLE_NAMES = ["President", "Vice President", "General Secretary", "Joint Secretary", "Cultural Secretary"];

export default function ClubsPage() {
  const { token, hasPermission, loading: authLoading } = useAuth();
  const snackbar = useSnackbar();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [years, setYears] = useState<YearOpt[]>([]);
  const [academicYearId, setAcademicYearId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [instructors, setInstructors] = useState<InstructorOpt[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [chiefInstructorId, setChiefInstructorId] = useState("");
  const [roleSeed, setRoleSeed] = useState(DEFAULT_ROLE_NAMES.join(", "));

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    api<Club[]>("/api/clubs?limit=100", { token: token ?? undefined })
      .then(setClubs)
      .catch(() => setClubs([]))
      .finally(() => setLoading(false));
  }, [token, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    api<any[]>("/api/academic/years?include_counts=false", { token: token ?? undefined })
      .then((rows) => {
        const list: YearOpt[] = (rows || []).map((r: any) => ({
          id: r.id,
          academic_year_name: r.academic_year_name,
        }));
        setYears(list);
        if (!academicYearId && list.length > 0) setAcademicYearId(list[0].id);
      })
      .catch(() => setYears([]));
  }, [token, authLoading, academicYearId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q));
  }, [clubs, search]);

  async function createClub(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      snackbar.error("Club name is required.");
      return;
    }
    if (!academicYearId) {
      snackbar.error("Academic year is required.");
      return;
    }
    if (!chiefInstructorId) {
      snackbar.error("Chief moderator is required.");
      return;
    }
    setSaving(true);
    try {
      const created = await api<Club>("/api/clubs", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          academic_year_id: academicYearId || null,
          is_active: isActive,
        }),
      });

      await api("/api/clubs/moderators", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          club_id: created.id,
          instructor_id: chiefInstructorId,
          is_chief: true,
          academic_year_id: academicYearId,
        }),
      });

      const seedNames = roleSeed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (seedNames.length > 0) {
        await Promise.all(
          seedNames.map((n, idx) =>
            api(`/api/clubs/${created.id}/roles`, {
              token: token ?? undefined,
              method: "POST",
              body: JSON.stringify({ academic_year_id: academicYearId, name: n, rank: idx + 1, is_unique: true }),
            })
          )
        );
      }

      snackbar.success("Club created.");
      setCreateOpen(false);
      setName("");
      setDescription("");
      setIsActive(true);
      setChiefInstructorId("");
      setRoleSeed(DEFAULT_ROLE_NAMES.join(", "));
      setClubs((prev) => [created, ...prev]);
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to create club");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clubs</h1>
          <p className="text-sm text-[var(--muted)]">Create clubs, manage moderators, members, and posts.</p>
        </div>
        {hasPermission("clubs.manage") && (
          <button
            type="button"
            className={btnPrimary}
            onClick={async () => {
              setCreateOpen(true);
              if (instructors.length === 0 && !instructorsLoading) {
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
            }}
          >
            + New club
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clubs…"
          className={`${inputClass} max-w-sm`}
        />
        <p className="text-xs text-[var(--muted)]">
          Showing <strong>{filtered.length}</strong> of {clubs.length}
        </p>
      </div>

      <Card>
        {loading ? (
          <PageLoader minHeight="min-h-[10rem]" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)]">
                  <th className="pb-3">Club</th>
                  <th className="pb-3">Academic year</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-[var(--muted)]">
                      No clubs found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-[var(--muted)] line-clamp-1">{c.description ?? "—"}</p>
                      </td>
                      <td className="py-3 text-[var(--muted)]">{c.academic_year_id ?? "—"}</td>
                      <td className="py-3">
                        {c.is_active ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={"/dashboard/clubs/" + c.id}
                          className="text-[var(--foreground)] font-medium hover:underline"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => !saving && setCreateOpen(false)} title="New club" size="md">
        <form onSubmit={createClub} className="space-y-4">
          <div>
            <label className={labelClass}>Club name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} min-h-[90px]`}
              placeholder="What is this club about?"
            />
          </div>
          <div>
            <SelectField
              label="Academic year"
              value={academicYearId}
              onChange={setAcademicYearId}
              options={[
                { value: "", label: "Select academic year" },
                ...years.map((y) => ({ value: y.id, label: y.academic_year_name })),
              ]}
            />
          </div>
          <div>
            {instructorsLoading ? (
              <p className="text-sm text-[var(--muted)]">Loading instructors…</p>
            ) : (
              <SelectField
                label="Chief moderator (teacher)"
                value={chiefInstructorId}
                onChange={setChiefInstructorId}
                options={[
                  { value: "", label: "Select chief moderator" },
                  ...instructors.map((i) => ({ value: i.id, label: i.instructor_name })),
                ]}
              />
            )}
            {instructors.length === 0 && !instructorsLoading && (
              <button
                type="button"
                className={`${btnSecondary} mt-2`}
                onClick={async () => {
                  setInstructorsLoading(true);
                  try {
                    const rows = await api<any[]>("/api/instructors?limit=500", { token: token ?? undefined });
                    setInstructors((rows || []).map((r: any) => ({ id: r.id, instructor_name: r.instructor_name })));
                  } catch {
                    setInstructors([]);
                  } finally {
                    setInstructorsLoading(false);
                  }
                }}
              >
                Load teachers
              </button>
            )}
          </div>
          <div>
            <label className={labelClass}>Officer roles (comma-separated)</label>
            <input
              value={roleSeed}
              onChange={(e) => setRoleSeed(e.target.value)}
              className={inputClass}
              placeholder="President, Vice President, General Secretary"
            />
            <p className="text-xs text-[var(--muted)] mt-1">These will be created as unique roles for the selected year.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" className={btnSecondary} onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
