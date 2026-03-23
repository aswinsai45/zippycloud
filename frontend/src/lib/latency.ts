export type Provider = "aws" | "azure";

export interface LatencyResult {
  provider: Provider;
  ms: number | null;
  reachable: boolean;
}

// We ping public endpoints — good enough approximation
// of which cloud region is closer to the user
const ENDPOINTS: Record<Provider, string> = {
  aws: "https://s3.amazonaws.com",
  azure: "https://azure.microsoft.com",
};

async function probe(provider: Provider): Promise<LatencyResult> {
  const start = performance.now();
  try {
    await fetch(ENDPOINTS[provider], {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
    });
    const ms = Math.round(performance.now() - start);
    return { provider, ms, reachable: true };
  } catch {
    return { provider, ms: null, reachable: false };
  }
}

export async function measureBothProviders(): Promise<{
  aws: LatencyResult;
  azure: LatencyResult;
  fastest: Provider;
}> {
  const [aws, azure] = await Promise.all([probe("aws"), probe("azure")]);

  let fastest: Provider = "aws";
  if (!aws.reachable && azure.reachable) fastest = "azure";
  else if (aws.reachable && azure.reachable) {
    fastest = aws.ms! <= azure.ms! ? "aws" : "azure";
  }

  return { aws, azure, fastest };
}
