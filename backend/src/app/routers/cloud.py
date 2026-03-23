from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal
from app.dependencies import get_supabase, get_current_user
from app.latency import probe_once
import json, os
from cryptography.fernet import Fernet

router = APIRouter()

FERNET_KEY = os.environ["FERNET_KEY"]
fernet = Fernet(FERNET_KEY)

def encrypt_credentials(creds: dict) -> str:
    return fernet.encrypt(json.dumps(creds).encode()).decode()

def decrypt_credentials(token: str) -> dict:
    return json.loads(fernet.decrypt(token.encode()).decode())

class CloudConnectRequest(BaseModel):
    provider: Literal["aws", "azure"]
    credentials: dict

@router.post("/connect")
def connect_cloud(
    body: CloudConnectRequest,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    user_id = user["sub"]

    encrypted = encrypt_credentials(body.credentials)

    existing = (
        supabase.table("cloud_connections")
        .select("id")
        .eq("user_id", user_id)
        .eq("provider", body.provider)
        .execute()
    )

    if existing.data:
        supabase.table("cloud_connections").update(
            {"credentials": encrypted}
        ).eq("id", existing.data[0]["id"]).execute()
    else:
        supabase.table("cloud_connections").insert({
            "user_id": user_id,
            "provider": body.provider,
            "credentials": encrypted,
        }).execute()

    return {"status": "connected", "provider": body.provider}

@router.get("/latency-check")
async def latency_check(user: dict = Depends(get_current_user)):
    """Probe user's actual buckets and return real latency measurements."""
    supabase = get_supabase()
    user_id = user["sub"]

    rows = (
        supabase.table("cloud_connections")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    creds = {}
    for row in rows.data:
        creds[row["provider"]] = decrypt_credentials(row["credentials"])

    result = await probe_once(creds)
    return result