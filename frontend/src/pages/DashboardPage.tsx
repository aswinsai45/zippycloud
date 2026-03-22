import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { ZippyFile } from "../lib/supabase";
import {
  Upload,
  File,
  Download,
  Loader2,
  CloudOff,
  Cloud,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { clsx } from "clsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardPage() {
  const { session } = useAuth();
  const [files, setFiles] = useState<ZippyFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setLoadingFiles(true);
    const { data, error } = await supabase
      .from("files")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (!error && data) setFiles(data as ZippyFile[]);
    setLoadingFiles(false);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const uploadFile = async (file: File) => {
    if (!file) return;
    setUploadError("");
    setUploadSuccess("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }

      setUploadSuccess(`"${file.name}" uploaded successfully to AWS & Azure.`);
      fetchFiles();
    } catch (err: any) {
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const res = await fetch(`${API}/files/download/${fileId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Download failed");
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Upload and manage your files across AWS S3 & Azure Blob Storage.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={clsx(
          "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all mb-6",
          dragOver
            ? "border-sky-400 bg-sky-500/5"
            : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
        />

        {uploading ? (
          <>
            <Loader2 className="w-10 h-10 text-sky-400 animate-spin mb-3" />
            <p className="text-white font-medium">Uploading to both clouds…</p>
            <p className="text-zinc-500 text-sm mt-1">This may take a moment</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-white font-medium">
              Drop a file here or click to upload
            </p>
            <p className="text-zinc-500 text-sm mt-1">
              Uploaded simultaneously to AWS S3 and Azure Blob Storage
            </p>
          </>
        )}
      </div>

      {/* Feedback */}
      {uploadSuccess && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm mb-6">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {uploadSuccess}
        </div>
      )}
      {uploadError && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Files Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">Your Files</h2>
          <span className="text-zinc-500 text-sm">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loadingFiles ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading files…
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <CloudOff className="w-10 h-10 mb-3 opacity-40" />
            <p className="font-medium text-zinc-400">No files yet</p>
            <p className="text-sm mt-1">Upload your first file above</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                <th className="text-left px-6 py-3 font-medium">File</th>
                <th className="text-left px-6 py-3 font-medium">Size</th>
                <th className="text-left px-6 py-3 font-medium">Clouds</th>
                <th className="text-left px-6 py-3 font-medium">Uploaded</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {files.map((f) => (
                <tr
                  key={f.id}
                  className="hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <File className="w-4 h-4 text-zinc-400" />
                    </div>
                    <span className="text-white text-sm font-medium truncate max-w-xs">
                      {f.filename}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-400 text-sm">
                    {formatBytes(f.size)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
                          f.aws_key
                            ? "bg-orange-500/10 text-orange-400"
                            : "bg-zinc-800 text-zinc-600",
                        )}
                      >
                        <Cloud className="w-3 h-3" /> AWS
                      </span>
                      <span
                        className={clsx(
                          "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
                          f.azure_blob
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-zinc-800 text-zinc-600",
                        )}
                      >
                        <Cloud className="w-3 h-3" /> Azure
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 text-sm">
                    {timeAgo(f.uploaded_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDownload(f.id, f.filename)}
                      className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-sm font-medium transition-colors ml-auto"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
