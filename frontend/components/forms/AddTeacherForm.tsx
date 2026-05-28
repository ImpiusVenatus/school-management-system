"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { SelectField, GENDER_OPTIONS } from "@/components/ui/SelectField";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";

export type DepartmentOption = { id: string; name: string };
export type DesignationOption = { id: string; name: string };

interface AddTeacherFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  departments?: DepartmentOption[];
  designations?: DesignationOption[];
}

export function AddTeacherForm({ onSuccess, onCancel, departments = [], designations = [] }: AddTeacherFormProps) {
  const { token } = useAuth();
  const snackbar = useSnackbar();
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const departmentSelectOptions = useMemo(
    () => [{ value: "", label: "—" }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
    [departments]
  );

  const designationSelectOptions = useMemo(
    () => [{ value: "", label: "—" }, ...designations.map((d) => ({ value: d.id, label: d.name }))],
    [designations]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      snackbar.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/instructors", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          instructor_name: trimmed,
          employee_id: employeeId.trim() || undefined,
          department_id: departmentId || undefined,
          designation_id: designationId || undefined,
          gender: gender || undefined,
          status: "Active",
        }),
      });
      snackbar.success("Teacher created.");
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create teacher";
      setError(msg);
      snackbar.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Name *</label>
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Employee ID</label>
        <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Department</label>
        <SelectField
          options={departmentSelectOptions}
          value={departmentId}
          onChange={setDepartmentId}
          placeholder="Select department…"
        />
      </div>
      <div>
        <label className={labelClass}>Designation</label>
        <SelectField
          options={designationSelectOptions}
          value={designationId}
          onChange={setDesignationId}
          placeholder="Select designation…"
        />
        {designations.length === 0 && (
          <p className="text-xs text-[var(--muted)] mt-1">
            No designations yet.{" "}
            <Link href="/dashboard/settings?tab=designations" className="text-[var(--primary)] underline">
              Add designations in Settings
            </Link>
          </p>
        )}
      </div>
      <div>
        <label className={labelClass}>Gender</label>
        <SelectField options={GENDER_OPTIONS} value={gender} onChange={setGender} placeholder="—" />
      </div>
      <p className="text-xs text-gray-500">
        New teachers are created as Active. Departments and designations are managed in Settings.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Creating..." : "Create"}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
