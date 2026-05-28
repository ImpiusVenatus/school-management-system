"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AddTeacherForm, type DepartmentOption, type DesignationOption } from "@/components/forms/AddTeacherForm";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";
import { loadInstructorFormOptions } from "@/lib/instructor-options";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function NewTeacherPage() {
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    loadInstructorFormOptions(token)
      .then(({ departments: depts, designations: desigs }) => {
        setDepartments(depts);
        setDesignations(desigs);
      })
      .finally(() => setLoadingOpts(false));
  }, [authLoading, token]);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/teachers" className="text-gray-500 hover:text-gray-700">
        Back to Teachers
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">Add Teacher</h1>
      <Card>
        {authLoading || loadingOpts ? (
          <PageLoader minHeight="min-h-[8rem]" />
        ) : (
          <AddTeacherForm
            departments={departments}
            designations={designations}
            onSuccess={() => {
              router.push("/dashboard/teachers");
              router.refresh();
            }}
            onCancel={() => router.back()}
          />
        )}
      </Card>
    </div>
  );
}
