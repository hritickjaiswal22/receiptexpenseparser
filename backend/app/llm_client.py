from openai import AsyncOpenAI
from openai.lib import pydantic_function_tool
from dotenv import load_dotenv
from fastapi_ai_sdk import AIStreamBuilder
import os
import time
from typing import AsyncGenerator
import json

from app import database
from app.schemas import ExpenseToolInput

load_dotenv()

# Point the client to Groq's free, OpenAI-compatible endpoint
client = AsyncOpenAI(
    api_key=os.getenv("LLM_API_KEY"),
    base_url="https://api.groq.com/openai/v1" 
)

expense_tool = pydantic_function_tool(
    ExpenseToolInput,
    name="create_expense",
    description="Create a new expense record in the database for the authenticated user."
)

async def execute_create_expense(user_id: str, arguments: dict) -> str:
    """
    Insert an expense into the database and return a confirmation message.
    """
    # Prepare data with user_id
    expense_data = {**arguments, "user_id": user_id}
    
    try:
        response = await database.supabase_client.table("expenses").insert(expense_data).execute()
        if not response.data:
            return "Failed to insert expense: no data returned."
        return f"Expense created successfully with ID: {response.data[0]['id']}"
    except Exception as e:
        return f"Database error: {str(e)}"

async def get_llm_response(prompt: str, user_id: str) -> AsyncGenerator[str, None]:
    """
    Orchestrates the tool-calling loop with streaming and yields the final response.
    """
    messages = [
        {"role": "system", "content": "You are a helpful expense parsing assistant. Use the provided tools to record expenses when the user provides expense information."},
        {"role": "user", "content": prompt},
    ]

    while True:
        stream = await client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            tools=[expense_tool],
            temperature=0.2,
            stream=True,
        )

        # --- Accumulate streamed content and tool calls ---
        content_parts = []
        tool_calls = {}  # Use a dict to accumulate tool call deltas by index

        print("While loop top")

        async for chunk in stream:
            delta = chunk.choices[0].delta

            print("delta",delta)

            # Handle text content
            if delta.content:
                content_parts.append(delta.content)
                print(f"[{time.time():.3f}] yielding: {delta.content!r}", flush=True)
                yield delta.content  # Stream text to the frontend as it arrives

            # Handle tool call deltas
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls:
                        tool_calls[idx] = {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function.name, "arguments": ""}
                        }
                    if tc.function.arguments:
                        tool_calls[idx]["function"]["arguments"] += tc.function.arguments

        print(tool_calls)

        # --- After streaming finishes, check for tool calls ---
        if not tool_calls:
            # No tool calls, the response is complete
            break

        # Add the assistant's message (with tool calls) to the conversation
        messages.append({
            "role": "assistant",
            "content": "".join(content_parts) or None,
            "tool_calls": list(tool_calls.values())
        })

        # Execute each tool and add results to the conversation
        for tc in tool_calls.values():
            if tc["function"]["name"] == "create_expense":
                try:
                    arguments = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError as e:
                    # Handle malformed JSON gracefully
                    arguments = {}
                    tool_result = f"Error parsing arguments: {e}"
                else:
                    tool_result = await execute_create_expense(user_id, arguments)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": tool_result
                })

        # Loop back to let the model process the tool results and generate a final response

        