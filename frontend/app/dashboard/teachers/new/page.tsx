"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AddTeacherForm } from "@/components/forms/AddTeacherForm";
import { useRouter } from "next/navigation";

export default function NewTeacherPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/teachers" className="text-gray-500 hover:text-gray-700">
        Back to Teachers
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">Add Teacher</h1>
      <Card>
        <AddTeacherForm
          onSuccess={() => {
            router.push("/dashboard/teachers");
            router.refresh();
          }}
          onCancel={() => router.back()}
        />
      </Card>
    </div>
  );
}
