export type SettingsTab =
  | "profile"
  | "years"
  | "classes"
  | "departments"
  | "designations"
  | "subjects"
  | "grade-scales"
  | "roles"
  | "fee-categories"
  | "notifications"
  | "integrations"
  | "audit-log";

export const PLACEHOLDER_TABS: SettingsTab[] = [];

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
      { id: "departments", label: "Departments" },
      { id: "subjects", label: "Subjects" },
      { id: "grade-scales", label: "Grade scales" },
    ],
  },
  {
    heading: "Staff",
    items: [{ id: "designations", label: "Teacher designations" }],
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
      { id: "integrations", label: "Integrations" },
      { id: "audit-log", label: "Audit log" },
    ],
  },
];

export const TAB_META: Record<
  SettingsTab,
  { title: string; subtitle: string; breadcrumb: string }
> = {
  profile: {
    title: "School profile",
    subtitle: "Identity, contact, and branding.",
    breadcrumb: "School profile",
  },
  years: {
    title: "Academic years",
    subtitle: "Year cycle, active year, and historical years.",
    breadcrumb: "Academic years",
  },
  classes: {
    title: "Classes & sections",
    subtitle: "Grade levels and sections for the selected academic year.",
    breadcrumb: "Classes & sections",
  },
  departments: {
    title: "Departments",
    subtitle: "Group subjects by department (e.g. Languages, STEM). Nothing is predefined — your school defines these.",
    breadcrumb: "Departments",
  },
  designations: {
    title: "Teacher designations",
    subtitle: "Job titles for staff (e.g. Head Teacher, Senior Teacher). Assign when adding or editing teachers.",
    breadcrumb: "Teacher designations",
  },
  subjects: {
    title: "Subjects",
    subtitle: "Teachable subjects in your catalog. Assign them to classes from Classes & sections.",
    breadcrumb: "Subjects",
  },
  "grade-scales": {
    title: "Grade scales",
    subtitle: "A grade scale maps marks % to a letter grade and GPA. Each class uses one scale, falling back to the default.",
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
    subtitle: "Connect payments, SMS, email, SSO, and storage.",
    breadcrumb: "Integrations",
  },
  "audit-log": {
    title: "Audit log",
    subtitle: "Append-only record of state-changing actions.",
    breadcrumb: "Audit log",
  },
};

export const VALID_TABS: SettingsTab[] = [
  "profile",
  "years",
  "classes",
  "departments",
  "designations",
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
