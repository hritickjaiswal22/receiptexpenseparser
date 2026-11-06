from pydantic_ai import Agent, DeferredToolRequests, RunContext
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
import os
from dotenv import load_dotenv

from app import database
from app.schemas import ExpenseToolInput, ExpenseCategory, InputMethod

load_dotenv()

my_key = os.getenv("LLM_API_KEY")
custom_provider = GroqProvider(api_key=my_key)

# Initialize Pydantic AI Agent targeting Groq
model = GroqModel(
    "openai/gpt-oss-120b", 
    provider=custom_provider
)

# 1. Define agent with structured output type
agent = Agent(
    model,
    output_type=[ExpenseToolInput, DeferredToolRequests],
    system_prompt="You are a helpful expense parsing assistant. Parse the user's text into the required expense schema. Always call the create_expense tool to record it, which will prompt the user for approval.",
    retries={'output': 3}
)

# 2. Mark the DB tool to require human approval
@agent.tool(requires_approval=True)
async def create_expense(
    ctx: RunContext,
    date: str, 
    merchant: str, 
    amount: float, 
    expense_category: ExpenseCategory, 
    confidence: float, 
    input_method: InputMethod,
    description: str | None = None
) -> str:
    """
    Create a new expense record in the database. 
    Requires explicit user approval before execution.
    """
    # Access deps directly from ctx
    user_id = ctx.deps.get("user_id") if ctx.deps else None
    
    if not user_id:
        return "Error: No authenticated user context found."

    expense_data = {
        "date": date,
        "merchant": merchant,
        "amount": amount,
        "description": description,
        "expense_category": expense_category,
        "confidence": confidence,
        "input_method": input_method,
        "user_id": user_id
    }
    
    response = await database.supabase_client.table("expenses").insert(expense_data).execute()
    if not response.data:
        return "Failed to insert expense: no data returned."
    return f"Expense created successfully with ID: {response.data[0]['id']}"