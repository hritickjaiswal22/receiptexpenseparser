from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app import database
from app.auth import get_current_user
from app.llm_client import get_llm_response
from app.schemas import ChatRequest

from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the Supabase client
    await database.init_supabase()
    yield
    # Shutdown: Clean up the client
    await database.close_supabase()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], # Your Next.js URLs
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"], # Allows all headers (including Authorization)
)

@app.post("/llm", status_code=201)
async def parse_expense_endpoint(payload: ChatRequest,user: dict = Depends(get_current_user)):
    try:
        last_message = payload.messages[-1]
        user_text = "".join(
            part.text for part in last_message.parts if part.type == "text"
        )
        print(user)
        user_id = user["sub"]
        return StreamingResponse(
            get_llm_response(user_text,user_id),
            media_type="text/plain",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")


@app.get("/health/", status_code=201)
async def create_expense():
    return {"message": "Server running"}