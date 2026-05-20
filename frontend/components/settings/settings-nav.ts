export type SettingsTab =
  | "profile"
  | "years"
  | "classes"
  | "subjects"
  | "grade-scales"
  | "roles"
  | "fee-categories"
  | "notifications"
  | "integrations"
  | "audit-log";

export const PLACEHOLDER_TABS: SettingsTab[] = ["integrations", "audit-log"];

export type SettingsNavItem = {
  id: SettingsTab;
  label: string;
  placeholder?: boolean;
};

export type SettingsNavGroup = {
  heading: string;
  items: SettingsNavItem[];
};

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    heading: "School",
    items: [
      { id: "profile", label: "School profile" },
      { id: "years", label: "Academic years" },
    ],
  },
  {
    heading: "Academic",
    items: [
      { id: "classes", label: "Classes & sections" },
      { id: "subjects", label: "Subjects" },
      { id: "grade-scales", label: "Grade scales" },
    ],
  },
  {
    heading: "Access",
    items: [{ id: "roles", label: "Roles & permissions" }],
  },
  {
    heading: "Finance",
    items: [{ id: "fee-categories", label: "Fee categories" }],
  },
  {
    heading: "System",
    items: [
      { id: "notifications", label: "Notifications" },
      { id: "integrations", label: "Integrations", placeholder: true },
      { id: "audit-log", label: "Audit log", placeholder: true },
    ],
  },
];

export const TAB_META: Record<
  SettingsTab,
  { title: string; subtitle: string; breadcrumb: string }
> = {
  profile: {
    title: "School profile",
    subtitle: "Identity, contact, branding, and how the school runs in the system.",
    breadcrumb: "School profile",
  },
  years: {
    title: "Academic years",
    subtitle: "Classes, enrollments, exams, and fees are scoped to the active year.",
    breadcrumb: "Academic years",
  },
  classes: {
    title: "Classes & sections",
    subtitle: "Grade levels and sections for the selected academic year.",
    breadcrumb: "Classes & sections",
  },
  subjects: {
    title: "Subjects",
    subtitle: "Master catalog of subjects. Each class picks from this list.",
    breadcrumb: "Subjects",
  },
  "grade-scales": {
    title: "Grade scales",
    subtitle: "Grading schemes and mark boundaries.",
    breadcrumb: "Grade scales",
  },
  roles: {
    title: "Roles & permissions",
    subtitle: "Create roles, assign permissions, and attach users.",
    breadcrumb: "Roles & permissions",
  },
  "fee-categories": {
    title: "Fee categories & structures",
    subtitle: "Fee heads, structures by class, and payment methods.",
    breadcrumb: "Fee categories",
  },
  notifications: {
    title: "Notifications",
    subtitle: "Channels, event delivery, and templates.",
    breadcrumb: "Notifications",
  },
  integrations: {
    title: "Integrations",
    subtitle: "Payment gateways, calendars, and third-party tools.",
    breadcrumb: "Integrations",
  },
  "audit-log": {
    title: "Audit log",
    subtitle: "Who changed what and when.",
    breadcrumb: "Audit log",
  },
};

export const VALID_TABS: SettingsTab[] = [
  "profile",
  "years",
  "classes",
  "subjects",
  "grade-scales",
  "roles",
  "fee-categories",
  "notifications",
  "integrations",
  "audit-log",
];

export function tabFromParam(param: string | null): SettingsTab {
  if (param && VALID_TABS.includes(param as SettingsTab)) return param as SettingsTab;
  return "profile";
}
