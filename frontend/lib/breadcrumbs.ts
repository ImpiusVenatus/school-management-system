const LABELS: Record<string, string> = {
  dashboard: "Overview",
  students: "Students",
  teachers: "Teachers",
  "student-groups": "Classes",
  courses: "Subjects",
  k12: "K-12",
  classes: "Classes",
  sections: "Sections",
  subjects: "Subjects",
  schedule: "Routine",
  attendance: "Attendance",
  admissions: "Admissions",
  exam: "Exams",
  fees: "Fees",
  notices: "Notices",
  clubs: "Clubs",
  files: "Files",
  settings: "Settings",
  roles: "Roles",
  new: "New",
  "by-class": "By class",
};

export function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const parts = pathname.replace(/^\/dashboard\/?/, "").split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [{ label: "Dashboard", href: "/dashboard" }];
  if (parts.length === 0) {
    crumbs.push({ label: "Overview" });
    return crumbs;
  }
  let path = "/dashboard";
  parts.forEach((part, i) => {
    path += `/${part}`;
    const label = LABELS[part] ?? part.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push(i === parts.length - 1 ? { label } : { label, href: path });
  });
  return crumbs;
}
