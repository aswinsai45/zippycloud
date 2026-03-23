export type Provider = "aws" | "azure";

export interface LatencyResult {
  provider: Provider;
  ms: number | null;
  reachable: boolean;
}

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function measureBothProviders(token: string): Promise<{
  aws: LatencyResult;
  azure: LatencyResult;
  fastest: Provider;
}> {
  try {
    const res = await fetch(`${API}/cloud/latency-check`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Latency check failed");

    const data = await res.json();

    return {
      aws: {
        provider: "aws",
        ms: data.aws_ms,
        reachable: data.aws_ms !== null,
      },
      azure: {
        provider: "azure",
        ms: data.azure_ms,
        reachable: data.azure_ms !== null,
      },
      fastest: data.winner as Provider,
    };
  } catch {
    // Fallback if endpoint fails
    return {
      aws: { provider: "aws", ms: null, reachable: false },
      azure: { provider: "azure", ms: null, reachable: false },
      fastest: "aws",
    };
  }
}
