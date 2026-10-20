from supabase import create_async_client, AsyncClient
from app.config import SUPABASE_URL, SUPABASE_SECRET_KEY

# This will hold our single, shared Supabase client instance
supabase_client: AsyncClient | None = None

async def init_supabase():
    """Initialize the async Supabase client using the SERVICE ROLE key.
    This client bypasses RLS and is used for backend-only operations."""
    global supabase_client
    supabase_client = await create_async_client(
        supabase_url=SUPABASE_URL,
        supabase_key=SUPABASE_SECRET_KEY  # Service role key
    )
    print("Supabase client initialized.")

async def close_supabase():
    """Cleanly close the client when the app shuts down."""
    if supabase_client:
        await supabase_client.aclose()
        print("Supabase client closed.")