from fastapi import FastAPI
import asyncio
from app.latency import run_latency_cache

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "ZippyCloud backend running"}

@app.on_event("startup")
async def startup_event():
    
    asyncio.create_task(run_latency_cache({}))