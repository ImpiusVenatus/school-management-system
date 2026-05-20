"use client";

import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { api, apiFormData, getApiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type FileItem = {
  id: string;
  original_filename: string;
  content_type: string | null;
  category: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  file_size: number | null;
  created_at: string | null;
};

const CATEGORIES = ["general", "admission", "teacher", "student_report", "notice"];

export default function FilesPage() {
  const { token } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("general");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (category) params.set("category", category);
    api<FileItem[]>("/api/files?" + params.toString(), { token })
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [token, category]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiFormData("/api/files/upload?category=" + encodeURIComponent(uploadCategory), form, { token });
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (category) params.set("category", category);
      const list = await api<FileItem[]>("/api/files?" + params.toString(), { token });
      setFiles(list);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDownload(f: FileItem) {
    if (!token) return;
    try {
      const res = await fetch(getApiUrl("/api/files/" + f.id + "/download"), { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.original_filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  async function deleteFile(fileId: string) {
    if (!token) return;
    try {
      await api("/api/files/" + fileId, { token, method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Files</h1>

      <Card>
        <div className="flex flex-wrap gap-4 mb-4 items-end">
          <div>
            <SelectField
              label="Filter by category"
              options={[{ value: "", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
              value={category}
              onChange={setCategory}
              placeholder="All"
              triggerClassName="w-40"
            />
          </div>
          <div>
            <SelectField
              label="Upload (category)"
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              value={uploadCategory}
              onChange={setUploadCategory}
              triggerClassName="w-40"
            />
          </div>
          <div>
            <input ref={fileInputRef} type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {uploading ? "Uploading..." : "Choose file to upload"}
            </button>
          </div>
        </div>
        {loading ? <p className="text-gray-500">Loading...</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Filename</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Size</th>
                <th className="pb-2">Created</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 ? <tr><td colSpan={5} className="py-4 text-gray-400">No files.</td></tr> : files.map((f) => (
                <tr key={f.id} className="border-b border-gray-100">
                  <td className="py-3 font-medium">{f.original_filename}</td>
                  <td className="py-3">{f.category}</td>
                  <td className="py-3">{f.file_size != null ? (f.file_size / 1024).toFixed(1) + " KB" : "—"}</td>
                  <td className="py-3">{f.created_at ? new Date(f.created_at).toLocaleString() : "—"}</td>
                  <td className="py-3 flex gap-2">
                    <button type="button" onClick={() => handleDownload(f)} className="text-[var(--foreground)] font-medium hover:underline">Download</button>
                    <button type="button" onClick={() => deleteFile(f.id)} className="text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
