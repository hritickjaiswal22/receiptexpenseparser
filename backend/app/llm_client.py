from openai import AsyncOpenAI
from dotenv import load_dotenv
from fastapi_ai_sdk import AIStreamBuilder
import os
import time

load_dotenv()

# Point the client to Groq's free, OpenAI-compatible endpoint
client = AsyncOpenAI(
    api_key=os.getenv("LLM_API_KEY"),
    base_url="https://api.groq.com/openai/v1" 
)

async def get_llm_response(prompt: str):
    stream = await client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        stream=True,
        reasoning={"effort": "low"},
    )
    yielded_any = False
    async for chunk in stream:
        content = chunk.choices[0].delta.content

        if content:
            print(f"[{time.time():.3f}] yielding: {content!r}", flush=True)
            yielded_any = True
            yield content
            
        if not yielded_any:
            yield "(The model returned an empty response — try again.)"
        