"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { SelectField, GENDER_OPTIONS } from "@/components/ui/SelectField";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";

interface AddTeacherFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddTeacherForm({ onSuccess, onCancel }: AddTeacherFormProps) {
  const { token } = useAuth();
  const snackbar = useSnackbar();
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/api/instructors", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          instructor_name: name.trim(),
          employee_id: employeeId.trim() || undefined,
          department: department.trim() || undefined,
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
        <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Gender</label>
        <SelectField options={GENDER_OPTIONS} value={gender} onChange={setGender} placeholder="—" />
      </div>
      <p className="text-xs text-gray-500">New teachers are created as Active.</p>
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
