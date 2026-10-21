import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Point the client to Groq's free, OpenAI-compatible endpoint
client = OpenAI(
    api_key=os.getenv("LLM_API_KEY"),
    base_url="https://api.groq.com/openai/v1" 
)

def get_llm_response(prompt: str):
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b", # A fast, free model on Groq
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
    )
    return response.choices[0].message.content