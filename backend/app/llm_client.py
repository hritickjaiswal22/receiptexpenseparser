from pydantic_ai import Agent, DeferredToolRequests, RunContext
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider
import os
from dotenv import load_dotenv

from app import database
from app.schemas import ExpenseBatch, ExpenseToolInput, List

load_dotenv()

my_key = os.getenv("LLM_API_KEY")
custom_provider = GroqProvider(api_key=my_key)

# Initialize Pydantic AI Agent targeting Groq
model = GroqModel(
    "openai/gpt-oss-120b", 
    provider=custom_provider
)

# 1. Define agent with structured output type
# Pydantic AI tracks two independent retry budgets:

# Output retries: Governed by retries={'output': N} (which you set to 3). This handles cases where the model's final structured output fails validation.

# Tool retries: Governed by retries={'tools': N}. This is a separate budget with a default value of 1 if not explicitly configured.
agent = Agent(
    model,
    output_type=[ExpenseBatch, DeferredToolRequests],
    system_prompt="You are a helpful expense parsing assistant. Parse the user's text into the required expense schema. If the input contains multiple expenses, include all of them in a single list. Always call the create_expense tool once with the full list to record it, which will prompt the user for approval.",
    retries={'output': 3,"tools": 3 }
)

# 2. Mark the DB tool to require human approval
@agent.tool(requires_approval=True)
async def create_expense(
    ctx: RunContext,
    expenses: List[ExpenseToolInput], 
) -> str:
    """
    Create new expense records in the database. 
    Requires explicit user approval before execution.
    """
    # Access deps directly from ctx
    user_id = ctx.deps.get("user_id") if ctx.deps else None
    
    if not user_id:
        return "Error: No authenticated user context found."

    expense_records = [
        {
            **expense.model_dump(mode='json'),  # if ExpenseToolInput is a Pydantic model
            "user_id": user_id,
        }
        for expense in expenses
    ]
    
    response = await database.supabase_client.table("expenses").insert(expense_records).execute()
    if not response.data:
        return "Failed to insert expense: no data returned."
    return f"Expense created successfully with ID: {response.data[0]['id']}"