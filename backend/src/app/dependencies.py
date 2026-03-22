import os
from supabase import create_client, Client
from fastapi import HTTPException, Header

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_current_user(authorization: str = Header(...)) -> dict:
    """Verify the JWT by calling Supabase's get_user() endpoint.
    Works with both legacy HS256 and new ECC (P-256) signing keys."""
    try:
        token = authorization.replace("Bearer ", "").strip()
        # Use the service-role client to validate the user token
        client = get_supabase()
        response = client.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        user = response.user
        return {"sub": user.id, "email": user.email}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
