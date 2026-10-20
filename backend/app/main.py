from contextlib import asynccontextmanager
from datetime import date
from fastapi import FastAPI, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app import database
from app.auth import get_current_user

from fastapi.middleware.cors import CORSMiddleware

# Define the shape of the data the client will send
class ExpenseCreate(BaseModel):
    date: date
    merchant: str
    amount: float
    description: str | None = None
    expense_category: str  # e.g., "GROCERIES", "DINING_OUT"
    confidence: float
    input_method: str  # e.g., "MANUAL", "TEXT_PASTE", "IMAGE"
    items: Optional[List[Dict[str, Any]]] = None

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

@app.post("/expenses/", status_code=201)
async def create_expense(
    expense: ExpenseCreate,
    user: dict = Depends(get_current_user)  # This enforces authentication
):
    """
    Dummy endpoint to create a new expense for the authenticated user.
    """
    user_id = user["sub"]  # 'sub' is the user's UUID from Supabase Auth

    # Prepare the data for the 'expenses' table
    expense_data = expense.model_dump(mode="json")
    expense_data["user_id"] = user_id

    # Use the shared async Supabase client to insert the row
    try:
        
        response = await database.supabase_client.table("expenses").insert(expense_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to insert expense")
        
        return {"message": "Expense created", "expense": response.data[0]}
    except Exception as e:
        # Handle Supabase/PostgREST errors
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/health/", status_code=201)
async def create_expense():
    return {"message": "Server running"}