from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Request
from starlette.responses import Response
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from fastapi.middleware.cors import CORSMiddleware

from app import database
from app.auth import get_current_user
from app.llm_client import agent

@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.init_supabase()
    yield
    await database.close_supabase()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], # Your Next.js URLs
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"], # Allows all headers (including Authorization)
)

@app.post("/llm")
async def parse_expense_endpoint(
    request: Request,
    user: dict = Depends(get_current_user)
):
    try:
        # Inject user_id into agent run dependencies
        deps = {"user_id": user["sub"]}
        
        # dispatch_request handles parsing, streaming, and SSE encoding
        return await VercelAIAdapter.dispatch_request(
            request, 
            agent=agent, 
            sdk_version=6,  # Required for tool approval protocol
            deps=deps
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")
    
@app.get("/health/", status_code=201)
async def create_expense():
    return {"message": "Server running"}