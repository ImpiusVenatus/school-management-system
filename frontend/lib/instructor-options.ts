import { api } from "@/lib/api";
import type { DepartmentOption, DesignationOption } from "@/components/forms/AddTeacherForm";

type DesignationRow = DesignationOption & { teacher_count?: number };

export async function loadInstructorFormOptions(token?: string | null): Promise<{
  departments: DepartmentOption[];
  designations: DesignationOption[];
}> {
  const [deptRes, desigRes] = await Promise.allSettled([
    api<DepartmentOption[]>("/api/instructors/departments", { token: token ?? undefined }),
    api<DesignationRow[]>("/api/instructors/designations?active_only=true", { token: token ?? undefined }),
  ]);

  const departments =
    deptRes.status === "fulfilled" && Array.isArray(deptRes.value) ? deptRes.value : [];
  const designations =
    desigRes.status === "fulfilled" && Array.isArray(desigRes.value)
      ? desigRes.value.map((d) => ({ id: d.id, name: d.name }))
      : [];

  return { departments, designations };
}
