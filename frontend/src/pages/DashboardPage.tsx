import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { supabase, type ZippyFile } from "../lib/supabase";
import {
  measureBothProviders,
  type LatencyResult,
  type Provider,
} from "../lib/latency";
import {
  Upload,
  File,
  Download,
  Loader2,
  CloudOff,
  Cloud,
  Trash2,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { clsx } from "clsx";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
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

function LatencyBar({
  label,
  result,
  fastest,
  color,
}: {
  label: string;
  result: LatencyResult | null;
  fastest: Provider | null;
  color: "orange" | "blue";
}) {
  const isWinner = fastest && result?.provider === fastest;
  const ms = result?.ms ?? null;
  const maxMs = 300;
  const pct = ms ? Math.min((ms / maxMs) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span
        className={clsx(
          "text-xs font-medium w-16 flex-shrink-0",
          color === "orange" ? "text-orange-400" : "text-blue-400",
        )}
      >
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        {ms !== null && (
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-700",
              color === "orange" ? "bg-orange-400" : "bg-blue-400",
            )}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <span className="text-xs text-zinc-400 w-16 text-right flex-shrink-0">
        {ms !== null ? (
          <>
            {ms}ms
            {isWinner && (
              <span
                className={clsx(
                  "ml-1.5 text-xs",
                  color === "orange" ? "text-orange-400" : "text-blue-400",
                )}
              >
                ↑
              </span>
            )}
          </>
        ) : (
          <span className="text-zinc-600">unreachable</span>
        )}
      </span>
    </div>
  );
}

function LatencyWidget({
  aws,
  azure,
  fastest,
  probing,
}: {
  aws: LatencyResult | null;
  azure: LatencyResult | null;
  fastest: Provider | null;
  probing: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            Network Latency
          </span>
        </div>
        {probing ? (
          <span className="flex items-center gap-1.5 text-zinc-500 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            Probing…
          </span>
        ) : fastest ? (
          <span
            className={clsx(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              fastest === "aws"
                ? "bg-orange-500/10 text-orange-400"
                : "bg-blue-500/10 text-blue-400",
            )}
          >
            {fastest === "aws" ? "AWS S3" : "Azure"} faster for you
          </span>
        ) : null}
      </div>
      <div className="space-y-2">
        <LatencyBar
          label="AWS S3"
          result={aws}
          fastest={fastest}
          color="orange"
        />
        <LatencyBar
          label="Azure"
          result={azure}
          fastest={fastest}
          color="blue"
        />
      </div>
    </div>
  );
}

function StatsCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4">
      <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-white text-xl sm:text-2xl font-bold">{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [files, setFiles] = useState<ZippyFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);

  // Latency state
  const [awsLatency, setAwsLatency] = useState<LatencyResult | null>(null);
  const [azureLatency, setAzureLatency] = useState<LatencyResult | null>(null);
  const [fastest, setFastest] = useState<Provider | null>(null);
  const [probing, setProbing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const runProbe = async () => {
    if (!session?.access_token) return "aws"; // don't probe if no session yet
    setProbing(true);
    const result = await measureBothProviders(session?.access_token || "");
    setAwsLatency(result.aws);
    setAzureLatency(result.azure);
    setFastest(result.fastest);
    setProbing(false);
    return result.fastest;
  };

  const fetchFiles = async () => {
    setLoadingFiles(true);
    const { data, error } = await supabase
      .from("files")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (!error && data) setFiles(data as ZippyFile[]);
    setLoadingFiles(false);
  };

  const checkCredentials = async () => {
    const { data } = await supabase
      .from("cloud_connections")
      .select("id")
      .limit(1);
    setHasCredentials(!!(data && data.length > 0));
  };

  useEffect(() => {
    fetchFiles();
    checkCredentials();
  }, []);

  // Separate effect that waits for session
  useEffect(() => {
    if (!session) return;

    // Small delay to ensure session is fully ready
    const timeout = setTimeout(() => {
      runProbe();
    }, 500);

    const interval = setInterval(runProbe, 60000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [session]);

  const uploadFile = async (file: File) => {
    if (!file) return;
    if (!hasCredentials) {
      toast("error", "No cloud credentials set up. Go to Settings first.");
      navigate("/settings");
      return;
    }
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
      const result = await res.json();
      const bothUploaded = result.aws && result.azure;
      toast(
        bothUploaded ? "success" : "info",
        bothUploaded
          ? `"${file.name}" uploaded to AWS S3 & Azure.`
          : `"${file.name}" uploaded to ${result.aws ? "AWS S3" : "Azure"} only. ${result.warnings?.[0] || ""}`,
      );
      fetchFiles();
    } catch (err: any) {
      toast("error", err.message || "Upload failed.");
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

  const handleDownload = async (f: ZippyFile) => {
    setDownloadingId(f.id);
    try {
      // Re-probe right before download for freshest data
      const currentFastest = await runProbe();
      const res = await fetch(
        `${API}/files/download/${f.id}?prefer=${currentFastest}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      if (!res.ok) throw new Error("Download failed");
      const source = res.headers.get("X-Retrieved-From");
      const preferred = res.headers.get("X-Preferred");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.filename;
      a.click();
      URL.revokeObjectURL(url);
      const usedFallback = source !== preferred;
      toast(
        usedFallback ? "info" : "success",
        usedFallback
          ? `Downloaded via ${source === "aws" ? "AWS S3" : "Azure Blob"} (fallback — ${preferred === "aws" ? "AWS S3" : "Azure"} was unavailable).`
          : `Downloaded from ${source === "aws" ? "AWS S3" : "Azure Blob"} — fastest for your network.`,
      );
    } catch (err: any) {
      toast("error", err.message || "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (f: ZippyFile) => {
    if (
      !confirm(
        `Delete "${f.filename}"? This will permanently remove it from AWS S3, Azure, and ZippyCloud.`,
      )
    )
      return;
    setDeletingId(f.id);
    try {
      const res = await fetch(`${API}/files/${f.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      const result = await res.json();
      if (result.warnings) {
        toast(
          "info",
          `File removed but some cloud cleanup failed: ${result.warnings.join(", ")}`,
        );
      } else {
        toast(
          "success",
          `"${f.filename}" permanently deleted from all clouds.`,
        );
      }
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
    } catch (err: any) {
      toast("error", err.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const awsCount = files.filter((f) => f.aws_key).length;
  const azureCount = files.filter((f) => f.azure_blob).length;

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-white text-xl sm:text-2xl font-bold">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Upload and manage your files across AWS S3 &amp; Azure Blob Storage.
        </p>
      </div>

      {/* No credentials warning */}
      {hasCredentials === false && (
        <div
          onClick={() => navigate("/settings")}
          className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-4 mb-6 cursor-pointer hover:bg-amber-500/15 transition-colors"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-medium text-sm">
              No cloud credentials configured
            </p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Tap here to go to Settings and connect AWS or Azure.
            </p>
          </div>
        </div>
      )}

      {/* Latency Widget */}
      <LatencyWidget
        aws={awsLatency}
        azure={azureLatency}
        fastest={fastest}
        probing={probing}
      />

      {/* Stats */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatsCard label="Total files" value={files.length} />
          <StatsCard label="Total size" value={formatBytes(totalSize)} />
          <div className="col-span-2 sm:col-span-1">
            <StatsCard
              label="Cloud coverage"
              value={`${awsCount} AWS · ${azureCount} Azure`}
              sub="files per provider"
            />
          </div>
        </div>
      )}

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
          "border-2 border-dashed rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center cursor-pointer transition-all mb-6",
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
            <Loader2 className="w-9 h-9 text-sky-400 animate-spin mb-3" />
            <p className="text-white font-medium text-sm sm:text-base">
              Uploading to clouds…
            </p>
            <p className="text-zinc-500 text-xs sm:text-sm mt-1 text-center">
              Sending to AWS S3 and Azure simultaneously
            </p>
          </>
        ) : (
          <>
            <div className="w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-white font-medium text-sm sm:text-base">
              Drop a file or tap to browse
            </p>
            <p className="text-zinc-500 text-xs sm:text-sm mt-1 text-center">
              Uploaded simultaneously to AWS S3 and Azure Blob Storage
            </p>
          </>
        )}
      </div>

      {/* Files */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm sm:text-base">
            Your Files
          </h2>
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
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <table className="w-full">
                <thead>
                  <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left px-6 py-3 font-medium">File</th>
                    <th className="text-left px-6 py-3 font-medium">Size</th>
                    <th className="text-left px-6 py-3 font-medium">Clouds</th>
                    <th className="text-left px-6 py-3 font-medium">
                      Uploaded
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {files.map((f) => (
                    <tr
                      key={f.id}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <File className="w-4 h-4 text-zinc-400" />
                          </div>
                          <span className="text-white text-sm font-medium truncate max-w-xs">
                            {f.filename}
                          </span>
                        </div>
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDownload(f)}
                            disabled={!!downloadingId}
                            className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-sky-400/10 disabled:opacity-40"
                          >
                            {downloadingId === f.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            Download
                          </button>
                          <button
                            onClick={() => handleDelete(f)}
                            disabled={deletingId === f.id}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                          >
                            {deletingId === f.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-zinc-800/50">
              {files.map((f) => (
                <div key={f.id} className="px-4 py-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <File className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {f.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-zinc-500 text-xs">
                        {formatBytes(f.size)}
                      </span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-zinc-500 text-xs">
                        {timeAgo(f.uploaded_at)}
                      </span>
                      <span
                        className={clsx(
                          "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full",
                          f.aws_key
                            ? "bg-orange-500/10 text-orange-400"
                            : "bg-zinc-800 text-zinc-600",
                        )}
                      >
                        <Cloud className="w-2.5 h-2.5" /> AWS
                      </span>
                      <span
                        className={clsx(
                          "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full",
                          f.azure_blob
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-zinc-800 text-zinc-600",
                        )}
                      >
                        <Cloud className="w-2.5 h-2.5" /> Azure
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(f)}
                      disabled={!!downloadingId}
                      className="p-2 rounded-lg text-sky-400 hover:bg-sky-400/10 transition-colors disabled:opacity-40"
                    >
                      {downloadingId === f.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(f)}
                      disabled={deletingId === f.id}
                      className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                    >
                      {deletingId === f.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
