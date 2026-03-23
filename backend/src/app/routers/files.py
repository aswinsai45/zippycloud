import boto3
from azure.storage.blob import BlobServiceClient
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from app.dependencies import get_supabase, get_current_user
from app.routers.cloud import decrypt_credentials
import io, uuid
from app.latency import get_latency_cache

router = APIRouter()

def get_user_credentials(supabase, user_id: str) -> dict:
    """Fetch and decrypt cloud credentials for a user."""
    rows = (
        supabase.table("cloud_connections")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    creds = {}
    for row in rows.data:
        creds[row["provider"]] = decrypt_credentials(row["credentials"])
    return creds

def upload_to_s3(creds: dict, key: str, data: bytes, content_type: str) -> str:
    s3 = boto3.client(
        "s3",
        aws_access_key_id=creds["access_key_id"],
        aws_secret_access_key=creds["secret_access_key"],
        region_name=creds.get("region", "us-east-1"),
    )
    s3.put_object(
        Bucket=creds["bucket_name"],
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return key

def upload_to_azure(creds: dict, blob_name: str, data: bytes, content_type: str) -> str:
    conn_str = (
        f"DefaultEndpointsProtocol=https;"
        f"AccountName={creds['account_name']};"
        f"AccountKey={creds['account_key']};"
        f"EndpointSuffix=core.windows.net"
    )
    client = BlobServiceClient.from_connection_string(conn_str)
    blob = client.get_blob_client(container=creds["container_name"], blob=blob_name)
    blob.upload_blob(data, overwrite=True, content_settings={"content_type": content_type})
    return blob_name

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    user_id = user["sub"]
    creds = get_user_credentials(supabase, user_id)

    if not creds:
        raise HTTPException(status_code=400, detail="No cloud credentials configured. Go to Settings first.")

    data = await file.read()
    file_id = str(uuid.uuid4())
    key = f"{user_id}/{file_id}/{file.filename}"
    content_type = file.content_type or "application/octet-stream"

    aws_key = None
    azure_blob = None
    errors = []

    # Use latency cache to determine upload order
    cache = get_latency_cache()
    winner = cache.get("winner", "aws")
    providers = ["aws", "azure"] if winner == "aws" else ["azure", "aws"]

    for provider in providers:
        if provider == "aws" and "aws" in creds:
            try:
                aws_key = upload_to_s3(creds["aws"], key, data, content_type)
            except Exception as e:
                errors.append(f"AWS: {str(e)}")
        elif provider == "azure" and "azure" in creds:
            try:
                azure_blob = upload_to_azure(creds["azure"], key, data, content_type)
            except Exception as e:
                errors.append(f"Azure: {str(e)}")

    if aws_key is None and azure_blob is None:
        raise HTTPException(status_code=500, detail=f"Upload failed on all providers: {'; '.join(errors)}")

    supabase.table("files").insert({
        "id": file_id,
        "user_id": user_id,
        "filename": file.filename,
        "size": len(data),
        "mime_type": content_type,
        "aws_key": aws_key,
        "azure_blob": azure_blob,
    }).execute()

    return {
        "id": file_id,
        "filename": file.filename,
        "aws": aws_key is not None,
        "azure": azure_blob is not None,
        "warnings": errors if errors else None,
    }

@router.get("")
def list_files(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    user_id = user["sub"]
    result = (
        supabase.table("files")
        .select("*")
        .eq("user_id", user_id)
        .order("uploaded_at", desc=True)
        .execute()
    )
    return result.data

@router.get("/download/{file_id}")
def download_file(file_id: str, user: dict = Depends(get_current_user)):
    """Download with failover: try AWS first, fall back to Azure."""
    supabase = get_supabase()
    user_id = user["sub"]

    row = supabase.table("files").select("*").eq("id", file_id).eq("user_id", user_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="File not found")

    file_meta = row.data[0]
    creds = get_user_credentials(supabase, user_id)

    data = None
    source = None

    # Try AWS first
    if file_meta.get("aws_key") and "aws" in creds:
        try:
            s3 = boto3.client(
                "s3",
                aws_access_key_id=creds["aws"]["access_key_id"],
                aws_secret_access_key=creds["aws"]["secret_access_key"],
                region_name=creds["aws"].get("region", "us-east-1"),
            )
            obj = s3.get_object(Bucket=creds["aws"]["bucket_name"], Key=file_meta["aws_key"])
            data = obj["Body"].read()
            source = "aws"
        except Exception:
            pass  # Fall through to Azure

    # Failover to Azure
    if data is None and file_meta.get("azure_blob") and "azure" in creds:
        try:
            conn_str = (
                f"DefaultEndpointsProtocol=https;"
                f"AccountName={creds['azure']['account_name']};"
                f"AccountKey={creds['azure']['account_key']};"
                f"EndpointSuffix=core.windows.net"
            )
            client = BlobServiceClient.from_connection_string(conn_str)
            blob = client.get_blob_client(container=creds["azure"]["container_name"], blob=file_meta["azure_blob"])
            data = blob.download_blob().readall()
            source = "azure"
        except Exception:
            pass

    if data is None:
        raise HTTPException(status_code=503, detail="File unavailable on all cloud providers.")

    return StreamingResponse(
        io.BytesIO(data),
        media_type=file_meta.get("mime_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{file_meta["filename"]}"',
            "X-Retrieved-From": source,
        },
    )
