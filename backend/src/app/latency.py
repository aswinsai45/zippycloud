import asyncio
import time
import boto3
from azure.storage.blob import BlobServiceClient


# In-memory cache
_cache: dict = {
    "winner": "aws",
    "aws_ms": None,
    "azure_ms": None,
    "last_checked": None,
    "running": False,
}


def get_latency_cache() -> dict:
    return _cache


async def _probe_aws(creds: dict) -> float:
    try:
        start = time.monotonic()
        s3 = boto3.client(
            "s3",
            aws_access_key_id=creds["access_key_id"],
            aws_secret_access_key=creds["secret_access_key"],
            region_name=creds.get("region", "us-east-1"),
        )
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: s3.head_bucket(Bucket=creds["bucket_name"])
        )
        return (time.monotonic() - start) * 1000
    except Exception:
        return float("inf")


async def _probe_azure(creds: dict) -> float:
    try:
        start = time.monotonic()
        conn_str = (
            f"DefaultEndpointsProtocol=https;"
            f"AccountName={creds['account_name']};"
            f"AccountKey={creds['account_key']};"
            f"EndpointSuffix=core.windows.net"
        )
        client = BlobServiceClient.from_connection_string(conn_str)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: client.get_service_properties()
        )
        return (time.monotonic() - start) * 1000
    except Exception:
        return float("inf")


async def run_latency_cache(creds: dict):
    """Background task — probes both clouds every 60s and caches winner."""
    _cache["running"] = True
    while True:
        try:
            aws_ms, azure_ms = await asyncio.gather(
                _probe_aws(creds.get("aws", {})),
                _probe_azure(creds.get("azure", {})),
            )

            aws_finite = aws_ms != float("inf")
            azure_finite = azure_ms != float("inf")

            if aws_finite and azure_finite:
                winner = "aws" if aws_ms <= azure_ms else "azure"
            elif aws_finite:
                winner = "aws"
            elif azure_finite:
                winner = "azure"
            else:
                winner = "aws"  # both down, default

            _cache.update({
                "winner": winner,
                "aws_ms": round(aws_ms) if aws_finite else None,
                "azure_ms": round(azure_ms) if azure_finite else None,
                "last_checked": time.time(),
            })

        except Exception:
            pass  # never crash the background task

        await asyncio.sleep(60)
async def probe_once(creds: dict) -> dict:
    aws_ms = None
    azure_ms = None

    if "aws" in creds:
        try:
            result = await _probe_aws(creds["aws"])
            aws_ms = round(result) if result != float("inf") else None
        except Exception:
            aws_ms = None

    if "azure" in creds:
        try:
            result = await _probe_azure(creds["azure"])
            azure_ms = round(result) if result != float("inf") else None
        except Exception:
            azure_ms = None

    if aws_ms is not None and azure_ms is not None:
        winner = "aws" if aws_ms <= azure_ms else "azure"
    elif aws_ms is not None:
        winner = "aws"
    elif azure_ms is not None:
        winner = "azure"
    else:
        winner = "aws"

    return {
        "aws_ms": aws_ms,
        "azure_ms": azure_ms,
        "winner": winner,
    }