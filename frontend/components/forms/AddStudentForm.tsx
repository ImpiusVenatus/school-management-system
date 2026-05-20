"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";
import { SelectField, GENDER_OPTIONS, type DropdownOption } from "@/components/ui/SelectField";

type GuardianRow = { guardian_name: string; email_address: string; mobile_number: string; relation: string };

const RELATION_OPTIONS: DropdownOption[] = [
  { value: "", label: "—" },
  { value: "Father", label: "Father" },
  { value: "Mother", label: "Mother" },
  { value: "Guardian", label: "Guardian" },
  { value: "Others", label: "Others" },
];

interface AddStudentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddStudentForm({ onSuccess, onCancel }: AddStudentFormProps) {
  const { token } = useAuth();
  const snackbar = useSnackbar();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [country, setCountry] = useState("");

  const [guardians, setGuardians] = useState<GuardianRow[]>([{ guardian_name: "", email_address: "", mobile_number: "", relation: "" }]);

  const addGuardian = () => {
    setGuardians((g) => [...g, { guardian_name: "", email_address: "", mobile_number: "", relation: "" }]);
  };
  const updateGuardian = (index: number, field: keyof GuardianRow, value: string) => {
    setGuardians((g) => g.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };
  const removeGuardian = (index: number) => {
    setGuardians((g) => (g.length <= 1 ? g : g.filter((_, i) => i !== index)));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const guardianIds: { guardian_id: string; guardian_name: string; relation?: string }[] = [];
      for (const g of guardians.filter((x) => x.guardian_name.trim())) {
        const created = await api<{ id: string }>("/api/guardians", {
          token: token ?? undefined,
          method: "POST",
          body: JSON.stringify({
            guardian_name: g.guardian_name.trim(),
            email_address: g.email_address.trim() || undefined,
            mobile_number: g.mobile_number.trim() || undefined,
            relation: g.relation.trim() || undefined,
          }),
        });
        guardianIds.push({
          guardian_id: created.id,
          guardian_name: g.guardian_name.trim(),
          relation: g.relation.trim() || undefined,
        });
      }

      await api("/api/students", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          first_name: firstName.trim(),
          middle_name: middleName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          student_email_id: email.trim(),
          student_mobile_number: mobile.trim() || undefined,
          date_of_birth: dateOfBirth || undefined,
          blood_group: bloodGroup.trim() || undefined,
          gender: gender.trim() || undefined,
          nationality: nationality.trim() || undefined,
          joining_date: joiningDate || undefined,
          address_line_1: addressLine1.trim() || undefined,
          address_line_2: addressLine2.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          pincode: pincode.trim() || undefined,
          country: country.trim() || undefined,
          guardians: guardianIds,
        }),
      });
      snackbar.success("Student created.");
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create student";
      setError(msg);
      snackbar.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Personal</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelClass}>First name *</label><input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Middle name</label><input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Last name *</label><input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Email *</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Mobile</label><input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Date of birth</label><input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Blood group</label><input type="text" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. A+" className={inputClass} /></div>
          <div>
            <label className={labelClass}>Gender</label>
            <SelectField options={GENDER_OPTIONS} value={gender} onChange={setGender} placeholder="—" />
          </div>
          <div><label className={labelClass}>Nationality</label><input type="text" value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Joining date</label><input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className={inputClass} /></div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className={labelClass}>Address line 1</label><input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputClass} /></div>
          <div className="sm:col-span-2"><label className={labelClass}>Address line 2</label><input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>City</label><input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>State / Province</label><input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Pincode / ZIP</label><input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Country</label><input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} /></div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Guardians</h3>
          <button type="button" onClick={addGuardian} className="text-sm text-[var(--foreground)] font-medium hover:underline">+ Add guardian</button>
        </div>
        <div className="space-y-3">
          {guardians.map((g, i) => (
            <div key={i} className="p-3 border border-gray-100 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">Guardian {i + 1}</span>
                {guardians.length > 1 && <button type="button" onClick={() => removeGuardian(i)} className="text-xs text-red-600 hover:underline">Remove</button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div><label className={labelClass}>Name</label><input type="text" value={g.guardian_name} onChange={(e) => updateGuardian(i, "guardian_name", e.target.value)} className={inputClass} placeholder="Full name" /></div>
                <div><label className={labelClass}>Email</label><input type="email" value={g.email_address} onChange={(e) => updateGuardian(i, "email_address", e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Mobile</label><input type="text" value={g.mobile_number} onChange={(e) => updateGuardian(i, "mobile_number", e.target.value)} className={inputClass} /></div>
                <div>
                  <label className={labelClass}>Relation</label>
                  <SelectField
                    options={RELATION_OPTIONS}
                    value={g.relation}
                    onChange={(v) => updateGuardian(i, "relation", v)}
                    placeholder="—"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Creating..." : "Create Student"}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
