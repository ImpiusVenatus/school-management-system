"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";
import { ClassSetupPanel } from "@/components/settings/ClassSetupPanel";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";

type YearOption = { id: string; academic_year_name: string; is_active: boolean };

type K12Section = { id: string; name: string; capacity: number; student_count: number };
type K12ClassCard = {
  id: string;
  name: string;
  numeric_level: number | null;
  section_count: number;
  total_capacity: number | null;
  total_students: number;
  sections: K12Section[];
};

type ProgramGroup = {
  id: string;
  student_group_name: string;
  program_id: string | null;
  max_strength: number | null;
  students: { student_id: string }[];
};

type K12ClassCreated = {
  id: string;
  name: string;
  numeric_level: number | null;
  sections: { id: string; name: string; capacity: number; class_id: string }[];
};

function classSummary(c: K12ClassCard): string {
  if (c.sections.length === 0) return "No sections yet — add one with +";
  const cap = c.total_capacity ?? 0;
  return `${c.section_count} section${c.section_count === 1 ? "" : "s"} · ${c.total_students}/${cap} students`;
}

function IconEdit({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.862 4.487" />
    </svg>
  );
}

function mergeClassCard(c: K12ClassCard, patch: Partial<K12ClassCard>): K12ClassCard {
  const sections = patch.sections ?? c.sections;
  const total_capacity = sections.length ? sections.reduce((s, x) => s + x.capacity, 0) : null;
  const total_students = sections.reduce((s, x) => s + x.student_count, 0);
  return {
    ...c,
    ...patch,
    sections,
    section_count: sections.length,
    total_capacity,
    total_students,
  };
}

export function ClassesSectionsTab({
  token,
  schoolType,
  activeYearId,
  years,
  isActive = true,
}: {
  token?: string | null;
  schoolType: string;
  activeYearId: string | null;
  years: YearOption[];
  isActive?: boolean;
}) {
  const snackbar = useSnackbar();
  const [viewYearId, setViewYearId] = useState("");
  const [k12Classes, setK12Classes] = useState<K12ClassCard[]>([]);
  const [programGroups, setProgramGroups] = useState<ProgramGroup[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [classModal, setClassModal] = useState(false);
  const [sectionModal, setSectionModal] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<{ classId: string; section: K12Section } | null>(null);
  const [editProgramGroup, setEditProgramGroup] = useState<ProgramGroup | null>(null);
  const [className, setClassName] = useState("");
  const [addFirstSection, setAddFirstSection] = useState(true);
  const [sectionName, setSectionName] = useState("A");
  const [sectionCapacity, setSectionCapacity] = useState("60");
  const [maxStrength, setMaxStrength] = useState("60");
  const [saving, setSaving] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const viewYearIdRef = useRef(viewYearId);
  viewYearIdRef.current = viewYearId;
  const firstYearId = years[0]?.id ?? "";

  useEffect(() => {
    const id = activeYearId || firstYearId;
    if (!id) return;
    setViewYearId((prev) => (prev === id ? prev : id));
  }, [activeYearId, firstYearId]);

  const fetchStructure = useCallback(async (): Promise<K12ClassCard[] | ProgramGroup[] | null> => {
    const yearId = viewYearIdRef.current;
    if (!yearId) return null;
    if (schoolType === "k12") {
      return api<K12ClassCard[]>(`/api/k12/structure?academic_year_id=${encodeURIComponent(yearId)}`, {
        token: token ?? undefined,
      });
    }
    return api<ProgramGroup[]>(
      `/api/student-groups?academic_year_id=${encodeURIComponent(yearId)}&limit=200`,
      { token: token ?? undefined }
    );
  }, [schoolType, token]);

  const applyStructure = useCallback(
    (data: K12ClassCard[] | ProgramGroup[]) => {
      if (schoolType === "k12") {
        const list = data as K12ClassCard[];
        setK12Classes(list);
        setSelectedClassId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      } else {
        setProgramGroups(data as ProgramGroup[]);
        setSelectedClassId(null);
      }
    },
    [schoolType]
  );

  const snackbarRef = useRef(snackbar);
  snackbarRef.current = snackbar;

  const load = useCallback(
    async (opts?: { reset?: boolean }) => {
      const yearId = viewYearIdRef.current;
      if (!yearId) {
        setK12Classes([]);
        setProgramGroups([]);
        setInitialLoading(false);
        hasLoadedRef.current = false;
        return;
      }
      const showFullSpinner = opts?.reset || !hasLoadedRef.current;
      if (showFullSpinner) {
        setInitialLoading(true);
        if (opts?.reset) {
          setK12Classes([]);
          setProgramGroups([]);
        }
      }
      try {
        const data = await fetchStructure();
        if (data === null) return;
        applyStructure(data);
        hasLoadedRef.current = true;
        prevFetchKeyRef.current = `${yearId}:${schoolType}`;
      } catch {
        prevFetchKeyRef.current = "";
        snackbarRef.current.error("Could not load classes");
      } finally {
        setInitialLoading(false);
      }
    },
    [fetchStructure, applyStructure]
  );

  const prevFetchKeyRef = useRef("");
  useEffect(() => {
    if (!isActive || !viewYearId) return;
    const key = `${viewYearId}:${schoolType}`;
    if (prevFetchKeyRef.current === key && hasLoadedRef.current) return;
    if (prevFetchKeyRef.current !== key) {
      hasLoadedRef.current = false;
    }
    load({ reset: true });
  }, [viewYearId, schoolType, load, isActive]);

  const viewYear = years.find((y) => y.id === viewYearId);
  const isViewingActive = viewYearId === activeYearId;

  function openClassModal() {
    setClassName("");
    setAddFirstSection(true);
    setSectionName("A");
    setSectionCapacity("60");
    setMaxStrength("60");
    setClassModal(true);
  }

  function openSectionModal(classId: string) {
    setSectionModal(classId);
    setSectionName("");
    setSectionCapacity("60");
  }

  function parseCapacity(raw: string): number | null {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 500) return null;
    return n;
  }

  async function addK12Class(e: React.FormEvent) {
    e.preventDefault();
    if (!viewYearId) return snackbar.warning("Select an academic year first.");
    const cap = addFirstSection ? parseCapacity(sectionCapacity) : null;
    if (addFirstSection && cap === null) return snackbar.warning("Max students must be between 1 and 500.");
    if (addFirstSection && !sectionName.trim()) return snackbar.warning("Enter a section name (e.g. A).");

    setSaving(true);
    try {
      const created = await api<K12ClassCreated>("/api/k12/classes", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          academic_year_id: viewYearId,
          name: className.trim(),
          initial_section: addFirstSection
            ? { name: sectionName.trim(), capacity: cap }
            : undefined,
        }),
      });

      const sections: K12Section[] = (created.sections ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        capacity: s.capacity,
        student_count: 0,
      }));

      const card: K12ClassCard = {
        id: created.id,
        name: created.name,
        numeric_level: created.numeric_level ?? null,
        sections,
        section_count: sections.length,
        total_capacity: sections.length ? sections.reduce((sum, s) => sum + s.capacity, 0) : null,
        total_students: 0,
      };
      setK12Classes((prev) => [...prev, card]);
      setSelectedClassId(created.id);

      snackbar.success(addFirstSection ? "Class and section added." : "Class added.");
      setClassModal(false);
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setSaving(false);
    }
  }

  async function addK12Section(e: React.FormEvent) {
    e.preventDefault();
    if (!sectionModal) return;
    const cap = parseCapacity(sectionCapacity);
    if (cap === null) return snackbar.warning("Max students must be between 1 and 500.");
    if (!sectionName.trim()) return snackbar.warning("Enter a section name.");

    const classId = sectionModal;
    setSaving(true);
    try {
      const sec = await api<{ id: string; name: string; capacity: number }>("/api/k12/sections", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({ class_id: classId, name: sectionName.trim(), capacity: cap }),
      });

      setK12Classes((prev) =>
        prev.map((c) =>
          c.id !== classId
            ? c
            : mergeClassCard(c, {
                sections: [
                  ...c.sections,
                  { id: sec.id, name: sec.name, capacity: sec.capacity, student_count: 0 },
                ],
              })
        )
      );

      snackbar.success("Section added.");
      setSectionModal(null);
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to add section");
    } finally {
      setSaving(false);
    }
  }

  async function saveSectionEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSection) return;
    const cap = parseCapacity(sectionCapacity);
    if (cap === null) return snackbar.warning("Max students must be between 1 and 500.");
    setSaving(true);
    try {
      const sec = await api<{ id: string; name: string; capacity: number }>(
        `/api/k12/sections/${editSection.section.id}`,
        {
          token: token ?? undefined,
          method: "PATCH",
          body: JSON.stringify({ name: sectionName.trim(), capacity: cap }),
        }
      );
      setK12Classes((prev) =>
        prev.map((c) =>
          c.id !== editSection.classId
            ? c
            : mergeClassCard(c, {
                sections: c.sections.map((s) =>
                  s.id === sec.id ? { ...s, name: sec.name, capacity: sec.capacity } : s
                ),
              })
        )
      );
      snackbar.success("Section updated.");
      setEditSection(null);
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function saveProgramMax(e: React.FormEvent) {
    e.preventDefault();
    if (!editProgramGroup) return;
    const cap = parseCapacity(maxStrength);
    if (cap === null) return snackbar.warning("Max students must be between 1 and 500.");
    setSaving(true);
    try {
      await api(`/api/student-groups/${editProgramGroup.id}`, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({ max_strength: cap }),
      });
      setProgramGroups((prev) =>
        prev.map((g) => (g.id === editProgramGroup.id ? { ...g, max_strength: cap } : g))
      );
      snackbar.success("Max students updated.");
      setEditProgramGroup(null);
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  function openEditSection(classId: string, section: K12Section) {
    setEditSection({ classId, section });
    setSectionName(section.name);
    setSectionCapacity(String(section.capacity));
  }

  async function addProgramSection(e: React.FormEvent) {
    e.preventDefault();
    if (!viewYearId) return;
    const cap = parseCapacity(maxStrength);
    if (cap === null) return snackbar.warning("Max students must be between 1 and 500.");

    setSaving(true);
    try {
      const g = await api<ProgramGroup>("/api/student-groups", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          student_group_name: className.trim(),
          academic_year_id: viewYearId,
          group_based_on: "Batch",
          max_strength: cap,
          students: [],
          instructors: [],
        }),
      });

      setProgramGroups((prev) => [...prev, { ...g, students: g.students ?? [] }]);
      snackbar.success("Section created.");
      setClassModal(false);
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  if (!years.length) {
    return (
      <Card>
        <p className="text-[var(--muted)] text-sm">Create an academic year first, then add classes and sections here.</p>
      </Card>
    );
  }

  const gridLoading =
    initialLoading && (schoolType === "k12" ? k12Classes.length === 0 : programGroups.length === 0);
  const selectedClass = k12Classes.find((c) => c.id === selectedClassId) ?? null;
  const totalStudents = k12Classes.reduce((s, c) => s + c.total_students, 0);
  const meta = TAB_META.classes;

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          <>
            <SelectField
              label=""
              options={years.map((y) => ({
                value: y.id,
                label: y.is_active ? `${y.academic_year_name} (active)` : y.academic_year_name,
              }))}
              value={viewYearId}
              onChange={setViewYearId}
              className="min-w-[11rem]"
            />
            <button type="button" onClick={openClassModal} className={btnPrimary} disabled={!viewYearId || saving}>
              + {schoolType === "k12" ? "New class" : "New section"}
            </button>
          </>
        }
      />

      {!isViewingActive && viewYear && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Viewing <strong>{viewYear.academic_year_name}</strong> (not the active year). New enrollments use the active year.
        </p>
      )}

      {gridLoading ? (
        <PageLoader minHeight="min-h-[16rem]" />
      ) : schoolType === "k12" ? (
        k12Classes.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">No classes for this year. Add a class (e.g. G1, KG).</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(220px,260px)_1fr] gap-6">
            <Card className="p-0 overflow-hidden">
              <p className="px-4 py-3 text-xs font-semibold text-[var(--muted)] border-b border-[var(--border)]">
                {k12Classes.length} classes · {totalStudents} students
              </p>
              <ul className="divide-y divide-[var(--border)] max-h-[520px] overflow-y-auto">
                {k12Classes.map((c) => {
                  const cap = c.total_capacity || 1;
                  const pct = Math.min(100, Math.round((100 * c.total_students) / cap));
                  const selected = c.id === selectedClassId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedClassId(c.id)}
                        className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                          selected ? "bg-[var(--primary-light)]" : "hover:bg-neutral-50"
                        }`}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-semibold text-sm">{c.name}</span>
                          <span className="text-[11px] text-[var(--muted)]">
                            {c.total_students}/{c.total_capacity ?? "—"}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--border)] mt-2 overflow-hidden">
                          <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-[var(--muted)] mt-1">
                          {c.sections.map((s) => s.name).join(", ") || "No sections"}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <div className="min-w-0">
              {selectedClass ? (
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedClass.name}</h3>
                      <p className="text-sm text-[var(--muted)]">{classSummary(selectedClass)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSectionModal(selectedClass.id)}
                      className={btnSecondary}
                      disabled={saving}
                    >
                      + Section
                    </button>
                  </div>
                  {selectedClass.sections.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No sections yet. Add section A, B, …</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedClass.sections.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => openEditSection(selectedClass.id, s)}
                          className="rounded-xl border border-[var(--border)] p-4 bg-white text-left hover:border-[var(--border-strong)] transition-colors w-full cursor-pointer"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-semibold text-base">{s.name}</p>
                            <span
                              className="shrink-0 p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-neutral-100"
                              aria-label="Edit section"
                            >
                              <IconEdit />
                            </span>
                          </div>
                          <p className="text-2xl font-bold mt-2">
                            {s.student_count}
                            <span className="text-sm font-normal text-[var(--muted)]"> / {s.capacity}</span>
                          </p>
                          <p className="text-[11px] text-[var(--muted)] mt-1">students · click to change max</p>
                          <div className="h-1.5 rounded-full bg-[var(--border)] mt-3 overflow-hidden">
                            <div
                              className="h-full bg-[var(--primary)] rounded-full"
                              style={{
                                width: `${Math.min(100, Math.round((100 * s.student_count) / s.capacity))}%`,
                              }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <ClassSetupPanel
                    token={token}
                    classId={selectedClass.id}
                    className={selectedClass.name}
                    onClassUpdated={(patch) => {
                      setK12Classes((prev) =>
                        prev.map((c) =>
                          c.id !== selectedClass.id
                            ? c
                            : {
                                ...c,
                                name: patch.name ?? c.name,
                                numeric_level: patch.numeric_level !== undefined ? patch.numeric_level : c.numeric_level,
                              }
                        )
                      );
                    }}
                  />
                </Card>
              ) : (
                <Card>
                  <p className="text-sm text-[var(--muted)]">Select a class from the list.</p>
                </Card>
              )}
            </div>
          </div>
        )
      ) : programGroups.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">No sections for this year. Add one (e.g. Grade 5-A).</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {programGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setEditProgramGroup(g);
                  setMaxStrength(String(g.max_strength ?? 40));
                }}
                className="rounded-xl border border-[var(--border)] bg-white p-4 text-left hover:border-[var(--border-strong)] w-full cursor-pointer"
              >
                <p className="font-semibold">{g.student_group_name}</p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {g.students?.length ?? 0} / {g.max_strength ?? "—"} students · click to edit max
                </p>
              </button>
            ))}
        </div>
      )}

      <Modal
        open={classModal}
        onClose={() => !saving && setClassModal(false)}
        title={schoolType === "k12" ? "Add class" : "Add section"}
        size="sm"
      >
        <form onSubmit={schoolType === "k12" ? addK12Class : addProgramSection} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{schoolType === "k12" ? "Class name" : "Section name"}</label>
            <input
              type="text"
              required
              autoFocus
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className={inputClass}
              placeholder={schoolType === "k12" ? "G1" : "Grade 5-A"}
            />
          </div>

          {schoolType === "k12" ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addFirstSection}
                  onChange={(e) => setAddFirstSection(e.target.checked)}
                />
                Add first section now
              </label>
              {addFirstSection && (
                <div className="grid grid-cols-2 gap-3 pl-0">
                  <div>
                    <label className="block text-sm font-medium mb-1">Section</label>
                    <input
                      type="text"
                      required={addFirstSection}
                      maxLength={50}
                      value={sectionName}
                      onChange={(e) => setSectionName(e.target.value)}
                      className={inputClass}
                      placeholder="A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Max students</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      required={addFirstSection}
                      value={sectionCapacity}
                      onChange={(e) => setSectionCapacity(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Max students</label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={maxStrength}
                onChange={(e) => setMaxStrength(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setClassModal(false)} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editSection !== null}
        onClose={() => !saving && setEditSection(null)}
        title="Edit section"
        size="sm"
      >
        <form onSubmit={saveSectionEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Section name</label>
              <input
                type="text"
                required
                maxLength={50}
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max students</label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={sectionCapacity}
                onChange={(e) => setSectionCapacity(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditSection(null)} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editProgramGroup !== null}
        onClose={() => !saving && setEditProgramGroup(null)}
        title="Edit max students"
        size="sm"
      >
        <form onSubmit={saveProgramMax} className="space-y-4">
          <p className="text-sm text-[var(--muted)]">{editProgramGroup?.student_group_name}</p>
          <div>
            <label className="block text-sm font-medium mb-1">Max students</label>
            <input
              type="number"
              min={1}
              max={500}
              required
              value={maxStrength}
              onChange={(e) => setMaxStrength(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditProgramGroup(null)} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={sectionModal !== null}
        onClose={() => !saving && setSectionModal(null)}
        title="Add section"
        size="sm"
      >
        <form onSubmit={addK12Section} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Section name</label>
              <input
                type="text"
                required
                maxLength={50}
                autoFocus
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                className={inputClass}
                placeholder="B or Mountain Lions"
              />
              <p className="text-[11px] text-[var(--muted)] mt-1">Up to 50 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max students</label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={sectionCapacity}
                onChange={(e) => setSectionCapacity(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setSectionModal(null)} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Adding…" : "Add section"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
