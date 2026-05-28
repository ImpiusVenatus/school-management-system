"use client";

import { useCallback, useEffect, useMemo, useState, Suspense, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { api } from "@/lib/api";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { SchoolProfileTab } from "@/components/settings/SchoolProfileTab";
import { AcademicYearsTab, type AcademicYearRow } from "@/components/settings/AcademicYearsTab";
import { ClassesSectionsTab } from "@/components/settings/ClassesSectionsTab";
import { DepartmentsTab } from "@/components/settings/DepartmentsTab";
import { DesignationsTab } from "@/components/settings/DesignationsTab";
import { SubjectsTab } from "@/components/settings/SubjectsTab";
import { GradeScalesTab } from "@/components/settings/GradeScalesTab";
import { FeeCategoriesTab } from "@/components/settings/FeeCategoriesTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { RolesSettingsTab } from "@/components/settings/RolesSettingsTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { AuditLogTab } from "@/components/settings/AuditLogTab";
import { tabFromParam, VALID_TABS, type SettingsTab } from "@/components/settings/settings-nav";
import type { SchoolProfile } from "@/components/settings/types";
import { Card } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";

function TabPanel({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div className={active ? undefined : "hidden"} aria-hidden={!active}>
      {children}
    </div>
  );
}

type TypeImpact = {
  current_school_type: string;
  target_school_type: string;
  program_data: Record<string, number>;
  k12_data: Record<string, number>;
  warnings: string[];
};

const EMPTY_PROFILE: SchoolProfile = {
  school_name: "",
  school_logo: "",
  school_type: "program",
  academic_year_start_month: 1,
  school_code: "",
  tagline: "",
  affiliation_board: "",
  registration_number: "",
  recognition_year: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  brand_color: "#14140F",
  currency_code: "BDT",
};

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user, loading: authLoading, hasPermission } = useAuth();
  const snackbar = useSnackbar();

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => tabFromParam(searchParams.get("tab")));
  const [profile, setProfile] = useState<SchoolProfile>(EMPTY_PROFILE);
  const [savedSchoolType, setSavedSchoolType] = useState<"program" | "k12">("program");
  const [schoolType, setSchoolType] = useState<"program" | "k12">("program");
  const [startMonth, setStartMonth] = useState(1);
  const [activeYearId, setActiveYearId] = useState<string | null>(null);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingType, setPendingType] = useState<"program" | "k12" | null>(null);
  const [impact, setImpact] = useState<TypeImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  const canManage = Boolean(user?.is_superuser || hasPermission("settings.manage"));

  const loadSettings = useCallback(async () => {
    try {
      const d = await api<SchoolProfile>("/api/settings", { token: token ?? undefined });
      setProfile({ ...EMPTY_PROFILE, ...d });
      const t = d.school_type === "k12" ? "k12" : "program";
      setSchoolType(t);
      setSavedSchoolType(t);
      setStartMonth(d.academic_year_start_month ?? 1);
      setActiveYearId(d.current_academic_year_id ?? null);
    } catch {
      snackbar.error("Failed to load settings");
    }
  }, [token, snackbar]);

  const loadYears = useCallback(async () => {
    try {
      const rows = await api<AcademicYearRow[]>("/api/academic/years?include_counts=false", {
        token: token ?? undefined,
      });
      setYears(rows);
      const active = rows.find((y) => y.is_active);
      if (active) setActiveYearId(active.id);
    } catch {
      /* years tab handles error */
    }
  }, [token]);

  const yearOptions = useMemo(
    () =>
      years.map((y) => ({
        id: y.id,
        academic_year_name: y.academic_year_name,
        is_active: y.is_active,
      })),
    [years]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user && !token) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([loadSettings(), loadYears()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // Intentionally only re-fetch on auth/session change — not when snackbar or callbacks change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token]);

  useEffect(() => {
    setActiveTab(tabFromParam(searchParams.get("tab")));
  }, [searchParams]);

  function onTabChange(tab: SettingsTab) {
    setActiveTab(tab);
    if (tab === "roles") return;
    const href = tab === "profile" ? "/dashboard/settings" : `/dashboard/settings?tab=${tab}`;
    router.replace(href, { scroll: false });
  }

  function onProfileChange(field: keyof SchoolProfile, value: string | number) {
    setProfile((p) => ({ ...p, [field]: value }));
  }

  /** Refresh year list only (no sidebar / full settings refetch). */
  function onYearsListChange() {
    loadYears();
  }

  /** Active year or school-wide settings changed — update sidebar label too. */
  function onActiveYearChange() {
    loadSettings();
    loadYears();
    window.dispatchEvent(new Event("school-settings-updated"));
  }

  async function persistProfile(typeToSave: "program" | "k12") {
    setSaving(true);
    try {
      await api<SchoolProfile>("/api/settings", {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({
          school_name: profile.school_name?.trim() || undefined,
          school_logo: profile.school_logo?.trim() || undefined,
          school_type: typeToSave,
          school_code: profile.school_code?.trim() || undefined,
          tagline: profile.tagline?.trim() || undefined,
          affiliation_board: profile.affiliation_board || undefined,
          registration_number: profile.registration_number?.trim() || undefined,
          recognition_year: profile.recognition_year?.trim() || undefined,
          address: profile.address?.trim() || undefined,
          phone: profile.phone?.trim() || undefined,
          email: profile.email?.trim() || undefined,
          website: profile.website?.trim() || undefined,
          brand_color: profile.brand_color?.trim() || undefined,
          currency_code: profile.currency_code || "BDT",
        }),
      });
      setSavedSchoolType(typeToSave);
      setSchoolType(typeToSave);
      snackbar.success("Settings saved.");
      window.dispatchEvent(new Event("school-settings-updated"));
      onActiveYearChange();
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to save");
      setSchoolType(savedSchoolType);
    } finally {
      setSaving(false);
      setConfirmOpen(false);
      setPendingType(null);
      setImpact(null);
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    if (schoolType !== savedSchoolType) {
      setImpactLoading(true);
      setPendingType(schoolType);
      try {
        const data = await api<TypeImpact>(
          `/api/settings/type-change-impact?target=${encodeURIComponent(schoolType)}`,
          { token: token ?? undefined }
        );
        setImpact(data);
        setConfirmOpen(true);
      } catch (err) {
        snackbar.error(err instanceof Error ? err.message : "Could not check school type impact");
        setSchoolType(savedSchoolType);
      } finally {
        setImpactLoading(false);
      }
      return;
    }

    await persistProfile(schoolType);
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Card>
          <p className="text-[var(--muted)]">Only users with settings permission can manage school setup.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <PageLoader minHeight="min-h-[50vh]" />;
  }

  return (
    <SettingsShell activeTab={activeTab} onTabChange={onTabChange} schoolType={schoolType}>
      <TabPanel active={activeTab === "profile"}>
        <SchoolProfileTab
          profile={profile}
          onChange={onProfileChange}
          schoolType={schoolType}
          setSchoolType={setSchoolType}
          savedSchoolType={savedSchoolType}
          saving={saving}
          impactLoading={impactLoading}
          onSave={handleProfileSubmit}
          confirmOpen={confirmOpen}
          setConfirmOpen={setConfirmOpen}
          impact={impact}
          pendingType={pendingType}
          onConfirmTypeChange={() => pendingType && persistProfile(pendingType)}
          onCancelTypeChange={() => {
            setConfirmOpen(false);
            setPendingType(null);
            setImpact(null);
            setSchoolType(savedSchoolType);
          }}
        />
      </TabPanel>
      <TabPanel active={activeTab === "years"}>
        <AcademicYearsTab
          token={token}
          startMonth={startMonth}
          onStartMonthChange={setStartMonth}
          onYearsListChange={onYearsListChange}
          onActiveYearChange={onActiveYearChange}
        />
      </TabPanel>
      <TabPanel active={activeTab === "classes"}>
        <ClassesSectionsTab
          token={token}
          schoolType={schoolType}
          activeYearId={activeYearId}
          years={yearOptions}
          isActive={activeTab === "classes"}
        />
      </TabPanel>
      <TabPanel active={activeTab === "departments"}>
        <DepartmentsTab token={token} />
      </TabPanel>
      <TabPanel active={activeTab === "designations"}>
        <DesignationsTab token={token} />
      </TabPanel>
      <TabPanel active={activeTab === "subjects"}>
        <SubjectsTab token={token} schoolType={schoolType} />
      </TabPanel>
      <TabPanel active={activeTab === "grade-scales"}>
        <GradeScalesTab token={token} />
      </TabPanel>
      <TabPanel active={activeTab === "roles"}>
        <RolesSettingsTab token={token} />
      </TabPanel>
      <TabPanel active={activeTab === "fee-categories"}>
        <FeeCategoriesTab token={token} years={yearOptions} activeYearId={activeYearId} />
      </TabPanel>
      <TabPanel active={activeTab === "notifications"}>
        <NotificationsTab token={token} />
      </TabPanel>
      <TabPanel active={activeTab === "integrations"}>
        <IntegrationsTab />
      </TabPanel>
      <TabPanel active={activeTab === "audit-log"}>
        <AuditLogTab token={token} />
      </TabPanel>
    </SettingsShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoader minHeight="min-h-[50vh]" />}>
      <SettingsPageInner />
    </Suspense>
  );
}
