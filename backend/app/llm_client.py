from openai import OpenAI
from dotenv import load_dotenv
from fastapi_ai_sdk import AIStreamBuilder
import os

load_dotenv()

# Point the client to Groq's free, OpenAI-compatible endpoint
client = OpenAI(
    api_key=os.getenv("LLM_API_KEY"),
    base_url="https://api.groq.com/openai/v1" 
)

def get_llm_response(prompt: str):
    # Initialize the builder for the AI SDK stream
    builder = AIStreamBuilder()
    builder.start()

    # Create a streaming completion with Groq
    stream = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        stream=True,  # <-- The crucial change
    )

    # Iterate over chunks and add them to the builder
    for chunk in stream:
        if chunk.choices[0].delta.content:
            builder.text(chunk.choices[0].delta.content)

    builder.finish()
    return builder