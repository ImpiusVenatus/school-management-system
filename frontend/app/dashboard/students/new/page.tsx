"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AddStudentForm } from "@/components/forms/AddStudentForm";
import { useRouter } from "next/navigation";

export default function NewStudentPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students" className="text-gray-500 hover:text-gray-700">
          ← Students
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Student</h1>
      </div>
      <Card>
        <AddStudentForm
          onSuccess={() => {
            router.push("/dashboard/students");
            router.refresh();
          }}
          onCancel={() => router.back()}
        />
      </Card>
    </div>
  );
}
