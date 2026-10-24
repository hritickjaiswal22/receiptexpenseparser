# global in python functions

```
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
```

In Python, the **`global`** keyword is used inside a function to tell Python: _"Hey, instead of creating a brand-new local variable inside this function, I want to use and modify the variable that lives outside of this function (at the file level)."_

Here is a breakdown of why it is needed in your code and how it works.

---

### 1. The Problem: Python's Scope Rules

In Python, variables defined outside of any function are called **global variables** (like your `supabase_client` at the very top of your script).

By default, when you are _inside_ a function and you try to **assign a value** to a variable using the `=` sign (like `supabase_client = ...`), Python assumes you are trying to create a **new, local variable** that only exists inside that specific function.

If you didn't use the `global` keyword in `init_supabase`, Python would create a temporary variable named `supabase_client` inside the function, assign the client to it, and then throw it away as soon as the function finished. The main `supabase_client` at the top of your file would remain `None`!

### 2. How `global` Solves It

By writing `global supabase_client` inside your function, you are explicitly giving Python permission to reach outside the function and change the value of the main, shared variable.

- **Without `global`:** Python creates a private copy inside the function.
- **With `global`:** Python modifies the shared master copy so that other parts of your app can use it too.

# auth.py

```
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import SUPABASE_JWKS_URL

security = HTTPBearer()
jwks_client = PyJWKClient(SUPABASE_JWKS_URL)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency that verifies the Supabase JWT and returns the user's payload.
    """
    token = credentials.credentials
    try:
        # 1. Fetch the signing key from Supabase's JWKS endpoint
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # 2. Decode and verify the token's signature and expiration
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            options={"verify_aud": False}, # Supabase tokens may not have a standard 'aud'
        )

        # 3. The user's unique ID from Supabase Auth is in the 'sub' claim
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing the 'sub' (user ID) claim",
            )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
```

Welcome to Python and FastAPI! It is a fantastic framework, but jumping from Node.js (Express) to Python can definitely feel like learning a whole new language of quirks. Let's break down your code piece by piece, drawing some parallels to Node.js to help it all click.

---

### 1. What is `HTTPBearer()`?

In Express (Node.js), you might write custom middleware to look at the `req.headers.authorization` header to find a token.

`HTTPBearer()` is a built-in security utility from FastAPI (`fastapi.security`). It tells FastAPI:

- Look for an incoming HTTP request.
- Check the **Authorization header**.
- Make sure it starts with the word `Bearer ` (e.g., `Authorization: Bearer eyJhbGciOi...`).
- If it's missing or malformed, automatically reject the request with a `403 Forbidden` before your route even runs.

---

### 2. What is `Depends`?

`Depends` is FastAPI’s core feature: **Dependency Injection**.

Think of it as FastAPI’s version of Express middleware, but much cleaner. When you put `Depends(security)` in your function arguments, you are telling FastAPI:

> _"Hey, before you run this function (`get_current_user`), run the `security` function first, grab whatever it returns, and pass it into my variable."_

---

### 3. What is `credentials: HTTPAuthorizationCredentials = Depends(security)`?

This is a single line doing three things at once:

1. **`Depends(security)`**: Runs the `HTTPBearer` checker to extract the Authorization header.
2. **`HTTPAuthorizationCredentials`**: This is a type hint (Python's way of saying "this variable must be this specific object type"). It represents the parsed credentials object.
3. **`credentials`**: The variable name holding the result.

Later in the code, `credentials.credentials` extracts the actual raw JWT string (stripping away the word "Bearer").

---

### 4. What is `signing_key` and why do I need it?

> _"I have used JWT in Node and there only a secret key was used no signing key nonsense"_

Ah, the classic Node.js vs. Enterprise Auth difference!

- **In Node.js (Symmetric - HS256):** You usually sign and verify tokens using the _exact same secret string_. Both you and the auth provider share a single secret.
- **In Supabase (Asymmetric - RS256):** Supabase uses public/private key cryptography. Supabase signs your token using a **private key** (which stays safe on their servers), and gives your server a **public key** to _verify_ it.

Because Supabase might rotate their keys occasionally, `PyJWKClient` downloads and caches the current **signing key** (the public key) from Supabase's JWKS (JSON Web Key Set) URL dynamically. You need it because you don't have a shared secret; you need their public key to prove the token actually came from Supabase and wasn't forged.

---

### 5. Why the heck are there 2 `except` blocks?

In Node.js, a `try...catch (err)` block catches _everything_, and you usually have to write `if (err.name === 'TokenExpiredError')` inside the catch block to figure out what went wrong.

Python handles errors by letting you catch **specific error types**. This is actually considered a cleaner practice because you can handle different failures differently:

1. **`except jwt.ExpiredSignatureError:`**
   This catches specifically when the token's `exp` (expiration time) has passed. You want to tell the user _"Hey, your token expired, please log in again."_
2. **`except jwt.PyJWTError as e:`**
   This is a catch-all for _other_ JWT issues—like a corrupted token, a bad signature, or a malformed string.

By separating them, you don't have to parse error strings or use messy `if/else` statements inside a single catch block.

# main.py

```
from contextlib import asynccontextmanager
from datetime import date
from fastapi import FastAPI, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app import database
from app.auth import get_current_user

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
```

Welcome to FastAPI and Python! You are actually looking at some very solid, modern FastAPI patterns here. Tackling things like Pydantic models, async functions, and lifespans early on is fantastic.

Let's break down each of the three pieces you asked about in plain, beginner-friendly terms.

---

### 1. `expense: ExpenseCreate,`

```python
async def create_expense(
    expense: ExpenseCreate,
    user: dict = Depends(get_current_user)
):

```

- **What it means:** This is a **type hint** combined with FastAPI's **automatic data validation**.
- **How it works:**

1. `expense` is just the name of the variable where the incoming data will be stored.
2. `ExpenseCreate` is the Pydantic class you defined right above it (which specifies that an expense needs a `date`, `merchant`, `amount`, etc.).
3. When someone sends a POST request to your API with JSON data, FastAPI looks at `ExpenseCreate`, automatically reads the incoming JSON, checks if all the required fields are there, and ensures they have the correct data types (like making sure `amount` is a float and not a string).
4. If everything looks good, it packages it up nicely into the `expense` variable for you to use. If something is missing or wrong, FastAPI automatically sends an error back to the client.

---

### 2. `expense_data = expense.model_dump(mode="json")`

```python
# Prepare the data for the 'expenses' table
expense_data = expense.model_dump(mode="json")
expense_data["user_id"] = user_id

```

- **What it means:** This line converts your Pydantic object back into a standard Python dictionary.
- **Why you need it:**
- Earlier, `expense` was a special Pydantic object. But your Supabase database client doesn't know how to save a Pydantic object directly—it expects a standard Python dictionary (`key: value` pairs).
- `.model_dump()` transforms `expense` into a dictionary like `{"merchant": "Starbucks", "amount": 4.50, ...}`.
- The `mode="json"` argument ensures that complex data types—like Python `date` objects—are safely converted into formats (like strings) that Supabase and JSON can easily understand.
- The next line (`expense_data["user_id"] = user_id`) simply adds the logged-in user's ID into that dictionary before sending it to the database.

---

### 3. The `lifespan` Function

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the Supabase client
    await database.init_supabase()
    yield
    # Shutdown: Clean up the client
    await database.close_supabase()

app = FastAPI(lifespan=lifespan)

```

- **What it means:** This is how FastAPI handles **Startup and Shutdown events** (things that need to happen the exact moment your app turns on, and the exact moment it turns off).
- **Breaking it down step-by-step:**
- **`@asynccontextmanager`**: A Python tool used to manage resources. It sets something up, lets your app run, and then cleans up after it.
- **`await database.init_supabase()` (Startup)**: This code runs **once** when you start your FastAPI server. It connects your app to Supabase so it's ready to handle requests.
- **`yield` (The Pause Point)**: Think of `yield` as a pause button. Everything _before_ `yield` runs when the server is starting up. Once it hits `yield`, FastAPI pauses, starts up the web server, and begins accepting user requests.
- **`await database.close_supabase()` (Shutdown)**: When you stop your server (like pressing `Ctrl + C` in your terminal), FastAPI resumes the lifespan function from right after the `yield` and safely closes the database connection so there are no memory leaks or open connections hanging around.
