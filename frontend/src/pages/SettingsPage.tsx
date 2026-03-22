import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  supabase,
  type CloudConnection,
  type CloudProvider,
} from "../lib/supabase";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { clsx } from "clsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ProviderFormProps {
  provider: CloudProvider;
  existing: CloudConnection | undefined;
  token: string;
  onSaved: () => void;
}

function ProviderForm({
  provider,
  existing,
  token,
  onSaved,
}: ProviderFormProps) {
  const isAWS = provider === "aws";
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState(
    isAWS
      ? {
          access_key_id: "",
          secret_access_key: "",
          bucket_name: "",
          region: "",
        }
      : { account_name: "", account_key: "", container_name: "" },
  );

  const setField = (key: string, val: string) =>
    setFields((f) => ({ ...f, [key]: val }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`${API}/cloud/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider, credentials: fields }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save");
      }
      setOpen(false);
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!existing) return;
    setRemoving(true);
    await supabase.from("cloud_connections").delete().eq("id", existing.id);
    setRemoving(false);
    onSaved();
  };

  const awsFields = [
    { key: "access_key_id", label: "Access Key ID", placeholder: "AKIA…" },
    {
      key: "secret_access_key",
      label: "Secret Access Key",
      placeholder: "••••••••",
      type: "password",
    },
    {
      key: "bucket_name",
      label: "Bucket Name",
      placeholder: "my-zippy-bucket",
    },
    { key: "region", label: "Region", placeholder: "us-east-1" },
  ];

  const azureFields = [
    {
      key: "account_name",
      label: "Storage Account Name",
      placeholder: "mystorageaccount",
    },
    {
      key: "account_key",
      label: "Account Key",
      placeholder: "••••••••",
      type: "password",
    },
    {
      key: "container_name",
      label: "Container Name",
      placeholder: "my-container",
    },
  ];

  const formFields = isAWS ? awsFields : azureFields;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <div
            className={clsx(
              "w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold",
              isAWS
                ? "bg-orange-500/10 text-orange-400"
                : "bg-blue-500/10 text-blue-400",
            )}
          >
            {isAWS ? "⬡" : "◈"}
          </div>
          <div>
            <h3 className="text-white font-semibold">
              {isAWS ? "Amazon S3" : "Azure Blob Storage"}
            </h3>
            <p className="text-zinc-500 text-sm">
              {isAWS
                ? "AWS S3 bucket credentials"
                : "Azure storage account credentials"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {existing ? (
            <>
              <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </span>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="ml-2 p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              >
                {removing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setOpen((v) => !v)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isAWS
                  ? "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                  : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
              )}
            >
              <Plus className="w-4 h-4" />
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {open && !existing && (
        <form
          onSubmit={handleSave}
          className="border-t border-zinc-800 px-6 py-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            {formFields.map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-zinc-300 text-sm font-medium mb-1.5">
                  {label}
                </label>
                <input
                  type={type || "text"}
                  value={(fields as any)[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={placeholder}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-red-400 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save credentials
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { session } = useAuth();
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = async () => {
    setLoading(true);
    const { data } = await supabase.from("cloud_connections").select("*");
    if (data) setConnections(data as CloudConnection[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const getConn = (p: CloudProvider) =>
    connections.find((c) => c.provider === p);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Connect your cloud provider accounts to enable file storage.
        </p>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 mb-6">
        <ShieldCheck className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white text-sm font-medium">
            Credentials are encrypted at rest
          </p>
          <p className="text-zinc-400 text-sm mt-0.5">
            Your cloud credentials are encrypted before being stored and are
            only used server-side to manage your files.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading connections…
        </div>
      ) : (
        <div className="space-y-4">
          <ProviderForm
            provider="aws"
            existing={getConn("aws")}
            token={session?.access_token || ""}
            onSaved={fetchConnections}
          />
          <ProviderForm
            provider="azure"
            existing={getConn("azure")}
            token={session?.access_token || ""}
            onSaved={fetchConnections}
          />
        </div>
      )}
    </div>
  );
}
