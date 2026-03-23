from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from app.latency import run_latency_cache
from app.routers import files, cloud, auth

app = FastAPI(title="ZippyCloud API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://zippycloud.vercel.app", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(files.router, prefix="/files", tags=["files"])
app.include_router(cloud.router, prefix="/cloud", tags=["cloud"])

@app.get("/")
def root():
    return {"message": "ZippyCloud backend running"}

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(run_latency_cache({}))