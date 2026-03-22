from fastapi import APIRouter

router = APIRouter()

# Auth is handled entirely by Supabase on the frontend.
# This router exists for future server-side auth actions
# (e.g. admin user management, password reset webhooks).

@router.get("/me")
def placeholder():
    return {"info": "Auth is managed by Supabase. Use the frontend SDK."}
