"use client";

import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import type { SchoolProfile } from "@/components/settings/types";
import { btnPrimary, inputClass, labelClass } from "@/lib/ui";

const CYCLE_OPTIONS = [
  { value: "4", label: "April – March" },
  { value: "1", label: "January – December" },
  { value: "6", label: "June – May" },
  { value: "9", label: "September – August" },
];

const BOARD_OPTIONS = [
  { value: "", label: "— Select board —" },
  { value: "CBSE", label: "CBSE" },
  { value: "ICSE", label: "ICSE" },
  { value: "State", label: "State board" },
  { value: "IB", label: "IB" },
  { value: "Cambridge", label: "Cambridge" },
  { value: "Other", label: "Other" },
];

const BRAND_PRESETS = [
  { hex: "#14140F", label: "Ink" },
  { hex: "#3D5C4C", label: "Moss" },
  { hex: "#B85C38", label: "Terracotta" },
  { hex: "#4A5568", label: "Indigo" },
  { hex: "#9B4D6A", label: "Rose" },
];

type TypeImpact = {
  current_school_type: string;
  target_school_type: string;
  program_data: Record<string, number>;
  k12_data: Record<string, number>;
  warnings: string[];
};

type ProfileField = keyof SchoolProfile;

export function SchoolProfileTab({
  profile,
  onChange,
  schoolType,
  setSchoolType,
  savedSchoolType,
  startMonth,
  setStartMonth,
  saving,
  impactLoading,
  onSave,
  confirmOpen,
  setConfirmOpen,
  impact,
  pendingType,
  onConfirmTypeChange,
  onCancelTypeChange,
}: {
  profile: SchoolProfile;
  onChange: (field: ProfileField, value: string | number) => void;
  schoolType: "program" | "k12";
  setSchoolType: (v: "program" | "k12") => void;
  savedSchoolType: "program" | "k12";
  startMonth: number;
  setStartMonth: (v: number) => void;
  saving: boolean;
  impactLoading: boolean;
  onSave: (e: React.FormEvent) => void;
  confirmOpen: boolean;
  setConfirmOpen: (v: boolean) => void;
  impact: TypeImpact | null;
  pendingType: "program" | "k12" | null;
  onConfirmTypeChange: () => void;
  onCancelTypeChange: () => void;
}) {
  const meta = TAB_META.profile;
  const str = (k: ProfileField) => (profile[k] as string) ?? "";

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        saving={saving || impactLoading}
        saveLabel="Save changes"
        onSave={() => {
          const form = document.getElementById("school-profile-form") as HTMLFormElement | null;
          form?.requestSubmit();
        }}
      />

      <form id="school-profile-form" onSubmit={onSave} className="space-y-6">
        <Card>
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Identity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
            <div className="sm:col-span-2">
              <label className={labelClass}>School name</label>
              <input
                type="text"
                value={str("school_name")}
                onChange={(e) => onChange("school_name", e.target.value)}
                className={inputClass}
                placeholder="Brookhaven Academy"
              />
            </div>
            <div>
              <label className={labelClass}>Short code</label>
              <input
                type="text"
                value={str("school_code")}
                onChange={(e) => onChange("school_code", e.target.value)}
                className={inputClass}
                placeholder="BHA"
                maxLength={20}
              />
            </div>
            <div>
              <label className={labelClass}>Tagline</label>
              <input
                type="text"
                value={str("tagline")}
                onChange={(e) => onChange("tagline", e.target.value)}
                className={inputClass}
                placeholder="Learning with purpose"
              />
            </div>
            <div>
              <SelectField
                label="Affiliation / board"
                options={BOARD_OPTIONS}
                value={str("affiliation_board")}
                onChange={(v) => onChange("affiliation_board", v)}
              />
            </div>
            <div>
              <label className={labelClass}>Registration no.</label>
              <input
                type="text"
                value={str("registration_number")}
                onChange={(e) => onChange("registration_number", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Recognition year</label>
              <input
                type="text"
                value={str("recognition_year")}
                onChange={(e) => onChange("recognition_year", e.target.value)}
                className={inputClass}
                placeholder="2010"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Logo URL</label>
              <input
                type="text"
                value={str("school_logo")}
                onChange={(e) => onChange("school_logo", e.target.value)}
                className={inputClass}
                placeholder="https://… or path"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Brand color</label>
              <div className="flex flex-wrap items-center gap-2">
                {BRAND_PRESETS.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    title={p.label}
                    onClick={() => onChange("brand_color", p.hex)}
                    className={`w-8 h-8 rounded-lg border-2 ${
                      str("brand_color") === p.hex ? "border-[var(--primary)]" : "border-transparent"
                    }`}
                    style={{ backgroundColor: p.hex }}
                  />
                ))}
                <input
                  type="text"
                  value={str("brand_color")}
                  onChange={(e) => onChange("brand_color", e.target.value)}
                  className={`${inputClass} max-w-[8rem]`}
                  placeholder="#14140F"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Contact & location</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
            <div className="sm:col-span-2">
              <label className={labelClass}>Address</label>
              <textarea
                value={str("address")}
                onChange={(e) => onChange("address", e.target.value)}
                className={`${inputClass} min-h-[80px]`}
                rows={3}
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                type="tel"
                value={str("phone")}
                onChange={(e) => onChange("phone", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={str("email")}
                onChange={(e) => onChange("email", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Website</label>
              <input
                type="url"
                value={str("website")}
                onChange={(e) => onChange("website", e.target.value)}
                className={inputClass}
                placeholder="https://school.edu"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Regional & format</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
            <SelectField
              label="Academic year cycle"
              options={CYCLE_OPTIONS}
              value={String(startMonth)}
              onChange={(v) => setStartMonth(parseInt(v, 10) || 4)}
            />
            <SelectField
              label="School type"
              options={[
                { value: "program", label: "Program-based (groups & programs)" },
                { value: "k12", label: "K-12 (classes & sections)" },
              ]}
              value={schoolType}
              onChange={(v) => setSchoolType(v === "k12" ? "k12" : "program")}
            />
          </div>
          {schoolType !== savedSchoolType && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4 max-w-3xl">
              Changing school type affects navigation only; existing data is kept.
            </p>
          )}
          <button type="submit" disabled={saving || impactLoading} className={`${btnPrimary} mt-4 hidden`}>
            Save
          </button>
        </Card>
      </form>

      <ConfirmModal
        open={confirmOpen}
        onClose={onCancelTypeChange}
        onConfirm={onConfirmTypeChange}
        title="Change school type?"
        confirmLabel="Change school type"
        variant="warning"
        loading={saving}
      >
        {impact && (
          <div className="space-y-3">
            <p>
              Switch from <strong>{impact.current_school_type}</strong> to <strong>{impact.target_school_type}</strong>?
            </p>
            <ul className="list-disc pl-4 space-y-1 text-sm">
              {impact.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </ConfirmModal>
    </>
  );
}
