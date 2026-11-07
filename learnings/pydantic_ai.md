https://chat.deepseek.com/a/chat/s/ce6332f3-1892-49b4-bb6f-1b492081ddbd
https://chat.deepseek.com/a/chat/s/ff104f09-89e8-4bbd-90d5-b5b065b133b2
https://chat.deepseek.com/a/chat/s/10c998eb-1919-48e1-9c61-95d6c794c768

# Learning Objectives

| Area                     | What you should understand                                                        |
| ------------------------ | --------------------------------------------------------------------------------- |
| Agent abstraction        | What does PydanticAI's Agent handle that your manual implementation handled?      |
| Agent configuration      | What do its parameters control? What happens when you change them?                |
| Tool calling             | How are tools registered, exposed to the model, validated and executed?           |
| Streaming                | What is being streamed? What events or data structures are exposed?               |
| Dependencies and context | How does application state reach the agent and its tools?                         |
| Confirmation flow        | Where does execution pause? What happens on approval, decline and resume?         |
| State management         | What needs to be persisted to resume a conversation safely?                       |
| Error handling           | What happens when the model fails, a tool fails, or a stream is interrupted?      |
| Architecture             | What complexity does the framework remove, and what complexity does it introduce? |

---

- Each and every line of code as a whole
- Architectural implication or working
- Tradeoffs
- Use cases
- And also investigate all the error that came along the way in chat https://chat.deepseek.com/a/chat/s/10c998eb-1919-48e1-9c61-95d6c794c768
- And most important engineering judgement

# pydantic_ai

First, let's understand the big picture: **Pydantic AI** is a Python framework designed to make building applications with Large Language Models (LLMs) less painful and more reliable. It was created by the same team behind Pydantic, a popular data validation library. The core idea is to bring **type safety** and **validation** to AI development, ensuring that the data going into and coming out of your AI agents is exactly what you expect.

Now, let's break down the three specific things you asked about.

### 🤖 `Agent`: The AI's "Brain" and "Body"

Think of an `Agent` as a self-contained container for everything your AI needs to perform a task. It's the primary interface you'll use to interact with an LLM.

An `Agent` holds all the key components, such as:

- **Instructions**: The system prompt that tells the LLM how to behave (e.g., "You are a helpful customer service agent").
- **Tools**: Functions the LLM can call to get information or perform actions, like checking a database or getting the weather.
- **Model**: The specific LLM to use (e.g., OpenAI's GPT-4, Anthropic's Claude, etc.).
- **Output Type**: The structured format the LLM's final answer should follow, which Pydantic AI will validate.

Here is a minimal example of creating an agent:

```python
from pydantic_ai import Agent

# Create an agent that uses OpenAI's GPT-4 model
agent = Agent('openai:gpt-4o')
```

Once you have an agent, you can run it with a prompt, and it will handle all the complex interactions with the LLM for you.

### ⏸️ `DeferredToolRequests`: Pausing for a "Human in the Loop"

This is a powerful feature for building safe and controllable AI applications. Normally, if an AI agent decides to use a tool (like `delete_file`), it just does it. But what if that action is dangerous and needs a human's approval first?

`DeferredToolRequests` is the mechanism that lets an agent **pause** and ask for permission or a result from an external source before proceeding.

When the LLM tries to call a tool that is marked as needing approval (`requires_approval=True`), the agent run doesn't fail. Instead, it stops and returns a `DeferredToolRequests` object. This object holds all the details about the tool call that is waiting for approval.

Your application code can then inspect this request, perhaps ask a human user "The AI wants to delete file X. Allow?", and then resume the agent's run with the approval (or denial) using a `DeferredToolResults` object.

**In short:** It's the tool that enables **Human-in-the-Loop (HITL)** workflows, making your AI safer and more trustworthy.

### 📋 `RunContext`: The Agent's "Context" or "Dependency Bag"

`RunContext` is all about **Dependency Injection**. It's a special object that gets passed into your agent's tools, system prompts, and output validators, giving them access to shared resources and information.

Think of it as a **contextual toolbox** that the agent carries with it during a run. You can put things into this toolbox, like a database connection, an API key, or a user's session information. Then, any tool or function that has `RunContext` as its first parameter can access these resources.

Here is a conceptual example:

```python
from dataclasses import dataclass
from pydantic_ai import Agent, RunContext

# Define a class for your dependencies (e.g., a database connection)
@dataclass
class MyDeps:
    db_connection: str

agent = Agent('openai:gpt-4o', deps_type=MyDeps)

@agent.tool
async def get_user_info(ctx: RunContext[MyDeps], user_id: int) -> str:
    # Access the database connection from the context
    db = ctx.deps.db_connection
    # ... use db to fetch user info ...
    return f"Info for user {user_id}"
```

**In short:** `RunContext` is the mechanism that allows you to cleanly provide your agent's tools with the **dependencies** they need to do their job, without using global variables or hardcoding values.

# Code

The code sets up a FastAPI backend that uses an AI agent to parse natural language into structured expense data. The most important concept here is **human-in-the-loop (HITL) approval**: the agent is allowed to _propose_ a database write, but it cannot actually execute it until a human explicitly approves.

Here is an in-depth explanation of how the two files work together.

---

### 🧠 `llm_client.py` — The AI Agent & the Approval Gate

This file defines the "brain" of the application: a Pydantic AI `Agent` configured to use a Groq-hosted LLM. It also defines the one tool the agent is allowed to use, with a critical safety guardrail.

#### 1. Model Setup (Groq Provider)

```python
custom_provider = GroqProvider(api_key=my_key)
model = GroqModel("openai/gpt-oss-120b", provider=custom_provider)
```

Here you create a `GroqModel` that points to the `openai/gpt-oss-120b` model served by Groq. The `GroqProvider` handles authentication and communication with Groq’s API using your `LLM_API_KEY`. This is a standard pattern in Pydantic AI for using Groq as a model backend.

#### 2. Agent Definition & Structured Output

```python
agent = Agent(
    model,
    output_type=[ExpenseToolInput, DeferredToolRequests],
    system_prompt="...",
    retries={'output': 3}
)
```

The `Agent` is the core orchestrator. Its `output_type` is a **union**: `[ExpenseToolInput, DeferredToolRequests]`. This tells the agent it can produce one of two kinds of final outputs:

- **`ExpenseToolInput`**: A structured Pydantic model (defined elsewhere in your project) that represents parsed expense data.
- **`DeferredToolRequests`**: A special Pydantic AI type that signifies “I want to call a tool, but this call must be deferred for human approval.” This is the linchpin of the HITL flow.

The `system_prompt` instructs the model to parse text and _always call the `create_expense` tool_, which will trigger the approval process. The `retries` parameter allows the agent to automatically retry output generation up to 3 times if the model produces invalid structured data.

#### 3. The Tool with `requires_approval=True`

```python
@agent.tool(requires_approval=True)
async def create_expense(ctx: RunContext, ...) -> str:
    ...
```

This is the crucial part. The decorator `@agent.tool(requires_approval=True)` registers the `create_expense` function as a tool _and_ marks it as requiring human approval. **Because of this flag, the agent will never execute the function directly.** Instead, when the LLM decides to call `create_expense`, Pydantic AI intercepts that call and ends the agent run early, returning a `DeferredToolRequests` object that contains the proposed tool arguments (date, merchant, amount, etc.).

If a human later approves the request, the `create_expense` function body finally runs. It extracts the `user_id` from `ctx.deps` (dependency injection), builds an `expense_data` dictionary, and inserts a new row into the `expenses` table via your Supabase client. This design keeps the tool function clean and focused on the actual database write, while the approval logic is handled externally.

---

### ⚙️ `main.py` — The FastAPI Backend & the HITL Bridge

This file exposes an HTTP endpoint (`POST /llm`) that the frontend calls. Its primary job is to bridge the gap between your Pydantic AI agent and the Vercel AI SDK frontend, which understands how to render approval buttons.

#### 1. Lifespan Management

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.init_supabase()
    yield
    await database.close_supabase()
```

This is a modern FastAPI pattern for managing resources that should be shared across the application’s lifetime. On startup, it initializes the Supabase client; on shutdown, it closes the connection. This avoids creating a new database connection for every request.

#### 2. CORS Middleware

The `CORSMiddleware` configuration allows your Next.js frontend (running on `localhost:3000`) to make authenticated requests to this backend. It permits credentials (like the `Authorization` header), which is necessary because the `/llm` endpoint requires a logged-in user.

#### 3. The `/llm` Endpoint (The Core Bridge)

```python
@app.post("/llm")
async def parse_expense_endpoint(
    request: Request,
    user: dict = Depends(get_current_user)
):
    try:
        deps = {"user_id": user["sub"]}
        return await VercelAIAdapter.dispatch_request(
            request,
            agent=agent,
            sdk_version=6,
            deps=deps
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")
```

This endpoint does three critical things:

1. **Authentication & Dependency Injection**: It uses `Depends(get_current_user)` to ensure the user is logged in. It then packages the user’s ID into a `deps` dictionary and passes it to the agent. This is how `ctx.deps.get("user_id")` inside `create_expense` gets its value.
2. **`VercelAIAdapter.dispatch_request`**: This single line is the workhorse. It takes the raw `Request` from the frontend, the configured `agent`, and the `deps`. It handles the entire agent execution loop: calling the LLM, parsing the response, detecting deferred tool requests, and formatting the result into a **Server-Sent Events (SSE) stream** that the Vercel AI SDK frontend can consume.
3. **`sdk_version=6`**: This parameter is **essential for the approval flow**. It tells the adapter to use the Vercel AI SDK v6 streaming protocol, which includes special chunk types for tool approval, such as `tool-approval-request` and `tool-output-denied`. Without this, the frontend would not know how to render the “Approve / Deny” interface for the `create_expense` tool.

---

### 🔄 How the Full Human-in-the-Loop Flow Works

Putting it all together, here is the sequence of events when a user types “Spent $20 at Starbucks yesterday”:

1. **Frontend** sends the text to `POST /llm`.
2. **`main.py`** authenticates the user, injects `user_id` into `deps`, and calls `VercelAIAdapter.dispatch_request`.
3. **Pydantic AI** runs the agent. The Groq LLM parses the text and decides to call `create_expense` with arguments like `{merchant: "Starbucks", amount: 20.0, ...}`.
4. **Because `requires_approval=True`**, Pydantic AI does **not** run `create_expense`. Instead, the agent run ends with a `DeferredToolRequests` output containing the proposed arguments.
5. **`VercelAIAdapter`** (with `sdk_version=6`) translates this deferred request into a streaming event: `tool-approval-request`. It sends this SSE event to the frontend.
6. **Frontend** (Vercel AI SDK) receives the event and renders an approval UI, showing the proposed expense details with “Approve” and “Deny” buttons.
7. **User clicks “Approve”**. The frontend sends a follow-up request to the backend, including the approval decision (a `tool-approval-response` chunk).
8. **`VercelAIAdapter`** on the backend detects the approval response and resumes the agent run with the necessary `DeferredToolResults`. Now, Pydantic AI finally executes the `create_expense` function.
9. **`create_expense`** inserts the expense into the Supabase database and returns a success message.
10. The final result is streamed back to the frontend, and the UI updates to show the confirmed expense.

This architecture cleanly separates concerns: the LLM handles the “thinking” (parsing), the tool handles the “doing” (database write), and the approval layer in between ensures that no irreversible action happens without human consent.

---

### 📚 Key Takeaway for Your Learning Path

This is a **production-grade pattern** for building safe, agentic applications. The `requires_approval=True` flag combined with `DeferredToolRequests` is Pydantic AI’s way of implementing **deferred tool execution**—a stateless, functional approach to human-in-the-loop workflows. It allows the agent to remain stateless and scalable, while still giving humans ultimate control over side-effectful operations like database writes.

If you want to deepen your understanding, explore how `DeferredToolResults` and `ToolDenied` are used to handle the resume step explicitly in cases where you need more granular control than the Vercel adapter provides.

# Are 2+ LLMs in the cloud being used?

**No — only one model is ever being used.** `GroqModel(...)` and `Agent(...)` are just **local Python objects**, not cloud resources. Nothing is "spawned" on Groq's servers when you instantiate them.

Let's trace what each object actually is:

```python
model = GroqModel("openai/gpt-oss-120b", provider=custom_provider)
```

This creates a `GroqModel` instance in your Python process. It's essentially a **client wrapper** — it holds the model name, the API key, the base URL, and some retry/timeout config. Think of it like `requests.Session()`: it's a config object that _knows how to talk_ to Groq, but it doesn't start anything. No network call happens here.

```python
agent = Agent(model, output_type=..., system_prompt=..., retries=...)
```

This wraps `model` with **orchestration logic**: it stores the system prompt, the registered tools, the output schema, and the retry policy. Still 100% local Python — no LLM involved yet.

### When does the LLM actually get invoked?

The LLM runs **only** when `VercelAIAdapter.dispatch_request(...)` (or `agent.run(...)`) is called. At that moment, Pydantic AI makes an HTTP POST to Groq's API. Groq runs inference on `openai/gpt-oss-120b` and returns the response.

**However**, a single `/llm` request can trigger **multiple LLM calls** — to the _same_ model — because of the agent loop:

1. **Call #1** → LLM parses "Spent $20 at Starbucks" and outputs a tool call for `create_expense`.
2. Pydantic AI sees `requires_approval=True` → **halts** the run and returns `DeferredToolRequests`. (No more LLM calls until the human approves.)
3. User approves → frontend resends → **Call #2** → LLM sees the tool result ("Expense created with ID: 42") and generates a final natural-language reply.
4. If output validation fails (structured output mismatch), the `retries={'output': 3}` can trigger up to 3 **more** calls to the same model.

So: **one model, potentially multiple round-trips to it**. This is the "agent loop" — the LLM doesn't magically maintain state; each call re-sends the full conversation history (including tool results) to Groq.

> 💡 **Mental model:** `GroqModel` = a phone number. `Agent` = your personal assistant who knows that phone number and a script. Calling the phone = one LLM inference. Multiple calls = multiple inferences, but always the same phone.

# Q2: How does the cloud LLM know about `create_expense`? Is my code transferred?

**Your code is never sent.** What _is_ sent is a **JSON description** of your tool's interface — generated locally by Pydantic AI from your Python type hints. This is the **function calling** (a.k.a. "tool use") protocol.

Here's the exact pipeline:

### Step 1: Pydantic AI introspects your function (locally)

When you decorate `create_expense` with `@agent.tool(...)`, Pydantic AI uses Python's `inspect` module to read:

- The function **name**: `"create_expense"`
- The **docstring** (used as the tool description): `"Create a new expense record in the database. Requires explicit user approval before execution."`
- The **parameter names + type hints + defaults**: `date: str`, `merchant: str`, `amount: float`, `expense_category: ExpenseCategory`, `confidence: float`, `input_method: InputMethod`, `description: str | None = None`

### Step 2: It converts those type hints into a JSON Schema (locally)

Pydantic models like `ExpenseCategory` and `InputMethod` (which are presumably `Enum`s or Pydantic models) get turned into schemas. Roughly:

```json
{
  "name": "create_expense",
  "description": "Create a new expense record in the database. Requires explicit user approval before execution.",
  "parameters": {
    "type": "object",
    "properties": {
      "date": { "type": "string" },
      "merchant": { "type": "string" },
      "amount": { "type": "number" },
      "expense_category": { "type": "string", "enum": ["food", "transport", "utilities", ...] },
      "confidence": { "type": "number" },
      "input_method": { "type": "string", "enum": ["text", "voice", ...] },
      "description": { "type": ["string", "null"], "default": null }
    },
    "required": ["date", "merchant", "amount", "expense_category", "confidence", "input_method"]
  }
}
```

**This is the only thing about your tool that crosses the network.** The function body — the Supabase insert, the `ctx.deps.get("user_id")`, the error handling — **stays on your machine forever**.

### Step 3: On each LLM call, Pydantic AI attaches that schema to the request

When the agent calls Groq, the HTTP payload (OpenAI-compatible format) looks conceptually like:

```json
{
  "model": "openai/gpt-oss-120b",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful expense parsing assistant..."
    },
    { "role": "user", "content": "Spent $20 at Starbucks yesterday" }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        /* the JSON schema above */
      }
    }
  ],
  "tool_choice": "auto"
}
```

The model (`gpt-oss-120b`) was **trained** to understand this `tools` field. It reads the schema as part of its context and learns: _"There's a callable named `create_expense` that takes these seven arguments, each with these types and enums."_

### Step 4: The LLM emits a tool _call_ (structured JSON), not code

When the model decides to use the tool, it doesn't run anything. It outputs a structured message like:

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "create_expense",
        "arguments": "{\"date\":\"2024-01-15\",\"merchant\":\"Starbucks\",\"amount\":20.0,\"expense_category\":\"food\",\"confidence\":0.95,\"input_method\":\"text\"}"
      }
    }
  ]
}
```

That's it. The LLM's "knowledge" of your tool is limited to **this schema** — nothing more.

### Step 5: Validation happens **locally**, not on Groq

Pydantic AI receives that `arguments` JSON string, parses it, and validates it against your **actual Pydantic models** (`ExpenseToolInput`, `ExpenseCategory`, etc.) — running in _your_ Python process. If the LLM hallucinated an invalid enum value or a negative amount (assuming you added `Field(gt=0)`), validation fails locally and Pydantic AI may retry the LLM.

> ⚠️ **Important subtlety:** If you add constraints like `Field(ge=0, le=10000)` on `amount`, Pydantic AI does send those _as part of the JSON schema description_ (e.g., `"minimum": 0, "maximum": 10000`), so the LLM is _informed_. But the LLM is **not trusted** to enforce them — the enforcement is done by Pydantic during validation. The schema is a hint; the Pydantic model is the source of truth.

### Step 6: Because of `requires_approval=True`, execution is deferred

Pydantic AI sees "the LLM wants to call `create_expense`, but this tool requires approval" → it **stops** the run and packages the proposed arguments into a `DeferredToolRequests` object. The frontend renders the approval UI. Only after you approve does the local `create_expense` body run.

---

## Summary Table

| Concept                                                                 | Where it lives                     | Sent to Groq?                                                 |
| ----------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `GroqModel`, `Agent` objects                                            | Your Python process                | No                                                            |
| Function body of `create_expense` (Supabase insert, etc.)               | Your Python process                | **Never**                                                     |
| Docstring of `create_expense`                                           | Your Python process                | Yes, as `tool.description`                                    |
| Parameter names + type hints                                            | Your Python process                | Yes, as JSON Schema                                           |
| Pydantic validation logic (`ExpenseCategory` enum, `Field` constraints) | Your Python process                | Only the _schema description_; validation itself runs locally |
| LLM weights (`gpt-oss-120b`)                                            | Groq's servers                     | —                                                             |
| The LLM's tool call (JSON)                                              | Generated on Groq, returned to you | Yes (in the response)                                         |
| `user_id`, Supabase credentials, DB row                                 | Your backend                       | **Never**                                                     |

This separation is exactly why function calling is safe: **the model proposes, your code disposes.** The model can only emit JSON that _looks_ like a call to your tool; it has no ability to run arbitrary code, read your environment variables, or touch your database. Your `requires_approval=True` adds a second layer — even a _valid_ proposal requires a human "yes" before your side-effectful code runs.

This is the fundamental pattern you'll use for almost every production agentic app: **the LLM is a structured-output generator, not an executor.** Your Python code is the only thing with real capabilities, and you gate it however you like (approval, rate limits, auth checks, dry-runs).

# Is the LLM stateless, and is the entire history + schemas resent every time?

**Yes, exactly.** The LLM has no memory. It is a pure function: `(messages, tools) → next_message`. Every single inference call is independent and knows nothing about previous calls except what is explicitly included in the payload.

### Where the history actually lives

In your frontend, `useChat` stores the `messages` array in **React component state** — nothing more. There is no automatic write to `localStorage`, a database, or a cookie. When the component unmounts (navigation, page reload, tab close), the history is **gone**. This is not a bug; Vercel made it a deliberate non-decision, leaving persistence to the developer.

### What gets sent on each request

Your `DefaultChatTransport` ships the **entire `messages` array** to `http://localhost:8000/llm` on every `sendMessage` call. The Vercel AI SDK documentation confirms that `useChat()` calls `sendMessages()` with the **full message array** and a `trigger` field. A stateless demo explicitly "ships the whole array each turn (`{ id, messages, trigger, messageId }`)".

On the backend, `VercelAIAdapter.dispatch_request` receives that array, and Pydantic AI **reconstructs the conversation** by sending it to Groq. The tool schemas (generated from your `create_expense` type hints) are also injected into every LLM call. The LLM has no persistent memory of `create_expense` between calls; it re-reads the schema fresh every time.

### The full request lifecycle (stateless slice)

```
Client (React state: messages[])
  └─ sendMessage({ text: "..." })
       └─ DefaultChatTransport.fetch → POST /llm
            ├─ Authorization: Bearer <supabase JWT>
            └─ Body: { messages: [...ALL_PRIOR_MESSAGES, newMessage], trigger: ... }
                 │
                 ▼
Backend (FastAPI /llm)
  └─ VercelAIAdapter.dispatch_request
       ├─ Converts UIMessage[] → ModelMessage[]
       ├─ Injects system_prompt + tool schemas
       ├─ Calls Groq (LLM sees ONLY what was sent)
       └─ Streams response back as SSE events
            │
            ▼
Client receives events → useChat reduces them into messages[]
```

**Key implication:** if the client loses its `messages` array, the conversation is unrecoverable from the server side — because the server never stored it in the first place.

### Persistence is something you must build

The standard pattern is to write messages to a database after each exchange and load them back via the `messages` prop on the next visit. But there are sharp edges:

- `useChat` works with `UIMessage` objects; the model expects `ModelMessage` objects. You must convert in both directions, and the return trip (stored → `UIMessage`) is not a single documented function call.
- For **deferred tool approvals specifically**, there is a known Pydantic AI bug: `dump_messages()` loses the `approval` metadata when reconstructing messages for reload, so the approve/reject UI disappears after a page refresh. You would need to manually patch the dumped output to re-inject `approval: { id: toolCallId }` on pending deferred tool parts.

This is why the AI SDK's **built-in stream resumption only covers one narrow case**: reconnecting to a generation that is _still actively running_ after a page reload. Returning to a _completed_ conversation is a separate problem that requires a real persistence layer.

# If the server crashes mid-run, is all progress lost?

**Yes, in your current architecture, everything is lost.** Your `ToolLoopAgent` (the default `Agent` in Pydantic AI) runs entirely **in memory**. If the process crashes, the function times out, or the deployment restarts, the agent's progress is gone. The user must start from scratch.

This is the fundamental limitation of a **stateless request/response** design applied to a **multi-step agent loop**.

### Why this is a real problem (not just an edge case)

Your workflow already has the shape that breaks under crashes:

1. **Multiple LLM round-trips** (parse → tool call → resume → final reply).
2. **A human-in-the-loop pause** that can last seconds, minutes, or days. If the server holds the deferred state only in memory, a restart during the approval wait destroys the pending tool call entirely.
3. **A side-effectful tool** (`create_expense`) that must **not** run twice if a retry happens after a partial failure.

The standard production workaround is an **assembly**: keep the agent loop in a framework, add a durability engine (Temporal, Restate, DBOS), and stand up Postgres or Redis for checkpoints. Every seam becomes something you build, secure, and pay for.

### The solution: durable execution

Durable execution engines solve this by **checkpointing every model call and every tool call** to persistent storage. If the process dies at step N, a new process resumes from the last completed step — no re-spent tokens, no lost approvals, no duplicated side effects.

For your Pydantic AI stack specifically, there are several paths:

| Approach                     | How it works                                                                                                                                                                                                                                               | Trade-off                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Temporal + Pydantic AI**   | Native integration: the agent runs as a Temporal Workflow; each LLM/tool call is an Activity with recorded history. Crashes resume from the last completed Activity.                                                                                       | Requires Temporal infrastructure; best for complex, long-running workflows. |
| **DBOS / Prefect / Restate** | Pydantic AI supports nine durable execution engines plus a builder for custom engines. DBOS is lightweight and Postgres-native.                                                                                                                            | Varies by engine; DBOS is a good middle-ground.                             |
| **`pydantic-ai-durable`**    | A library that wraps Pydantic AI with checkpointing over SQLite/Postgres. Turns auto-resume from the last checkpoint; mutating tools never duplicate on replay.                                                                                            | Newer library; adds a dependency layer.                                     |
| **Vercel WorkflowAgent**     | If you move the agent loop to Vercel's Workflow SDK, each tool call becomes a durable workflow step. Tools marked `needsApproval` suspend the workflow and resume automatically when the user responds — surviving process restarts and function timeouts. | Vercel-specific; best if you are deploying on Vercel.                       |

### What the durable flow looks like

```
Without durability:
  LLM Call → Tool Call → [CRASH] → Everything lost

With durability (e.g., Temporal/Restate):
  LLM Call (checkpointed) → Tool Call (checkpointed) → [CRASH]
    └─ New process starts → replays from last checkpoint → continues
```

For your specific `create_expense` tool, durability also gives you **replay safety**: if a crash happens after the Supabase insert but before the agent acknowledges it, a naive retry would create a **duplicate expense**. Durable engines solve this with idempotency keys or replay guards that mark mutating tools as "never duplicate on retry".

### Summary

| Question                                   | Answer                                                                                                                                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Is the LLM stateless?**                  | **Yes.** Every call is independent. It only knows what is in the `messages` array and `tools` schema sent in that specific request.                                                                                                    |
| **Is the full history resent every time?** | **Yes.** `useChat` ships the entire `messages` array to your backend, which forwards it to Groq. There is no server-side conversation memory by default.                                                                               |
| **Where is history stored?**               | **React component state only** (in your current code). Unmounting the component or reloading the page erases it. You must build server-side persistence yourself.                                                                      |
| **Does a server crash lose all progress?** | **Yes.** The default `ToolLoopAgent` runs in memory. A crash during a multi-step loop, a human approval wait, or a tool call discards everything.                                                                                      |
| **What is the production fix?**            | **Durable execution** — checkpoint every LLM and tool step to persistent storage so a new process can resume from the last completed step. Temporal, DBOS, Restate, or `pydantic-ai-durable` are the standard choices for Pydantic AI. |

# Confirmation flow

Your step-by-step intuition is **almost entirely correct**—but there is one crucial architectural correction: **it is not a single, long-lived HTTP request that stays open while the human thinks.** The flow is deliberately split into **at least two separate agent runs**, across two separate HTTP round-trips. The connection closes the moment the agent hits the approval gate, and a **new** connection is opened when the human responds.

Here is the corrected, precise version of your flow.

---

### ✅ The flow, with the critical correction

Your steps 1–4 are correct:

1. User sends the request text.
2. Backend starts the agent loop.
3. Full context (history + schemas) is sent to the LLM.
4. LLM returns a structured tool call for `create_expense`.

**Step 5 is where the split happens.** Pydantic AI does **not** keep the connection open to wait for the human. Instead:

> **5a.** The agent **ends the run immediately** and returns a `DeferredToolRequests` object. The SSE stream closes. The backend sends a `tool-approval-request` chunk to the frontend (if `sdk_version=6` is set correctly) and then **terminates the HTTP response**.
>
> **5b.** The frontend receives this, renders the approval UI, and **waits**—but it is no longer holding any server connection.

Steps 6–9 then happen on a **brand-new request**:

> **6.** User clicks “Approve.”
>
> **7.** The frontend **automatically sends a new HTTP request** (thanks to `sendAutomaticallyWhen={lastAssistantMessageIsCompleteWithApprovalResponses}`). This new request includes the **entire message history** from the first round **plus** the approval decision.
>
> **8.** The backend receives this, parses the approval decision into a `DeferredToolResults` object, and **starts a fresh agent run** with `message_history` and `deferred_tool_results`. This new run **executes the actual tool** (the Supabase insert) and continues the loop—potentially calling the LLM again with the tool result.
>
> **9.** The second run completes and streams its final response back. This second connection then closes.

Pydantic AI’s documentation is explicit about this: when a deferred tool is encountered, the run **ends** with `DeferredToolRequests`; the caller then “starts a new agent run with the original run’s message history plus a `DeferredToolResults` object”. It further states: “That follow-up is a **separate agent run** with its own `run_id` (do not reuse the paused run’s); keep pause/resume correlation via `conversation_id`”.

---

### 🔌 How does the agent “know” when to end the connection?

It does **not** wait for the human and then decide to close. The decision is deterministic and **pre-programmed**:

> **The agent ends the connection the instant it encounters a tool whose `requires_approval=True` (or that raises `ApprovalRequired`).**

There is no timeout logic, no polling, and no “wait for approval” loop inside the agent. The agent’s job is simply: _run until you hit a deferred tool, then stop and report._ The `DeferredToolRequests` object **is** the end-of-stream signal. The SSE stream naturally closes when the agent run finishes.

The “knowing when to end” is therefore not a runtime judgment—it is a **structural consequence** of the tool being marked as deferred. The agent cannot execute it, so it has nothing left to do; it returns control to the caller.

---

### 🧠 Why this design is intentional

If the server kept a single connection open during a human approval wait, you would run into severe problems:

| Single long-lived connection (your assumption)                                                                           | Split runs (actual design)                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A function timeout (e.g., 30s on Vercel, 60s on many platforms) would kill the request while the user is still thinking. | The first connection closes cleanly; the second starts fresh whenever the user is ready.            |
| A server restart during the approval wait would lose the pending tool call.                                              | The pending state lives in the **client’s message history**, so a server restart does not erase it. |
| You would hold a worker/thread hostage for minutes or hours.                                                             | Workers are freed immediately after emitting the deferred request.                                  |
| Scaling would be impossible—every pending approval consumes a live connection.                                           | Statelessness enables horizontal scaling.                                                           |

This is why Pydantic AI’s deferred-tool docs emphasize that the **stateless, functional** design is deliberate. The “state” of the approval is carried in the **conversation history** that the client persists and resends, not in a server-side connection.

---

### 📦 What actually bridges the two runs?

The bridge is entirely on the **frontend side**, orchestrated by the Vercel AI SDK:

- The first SSE stream ends with a `tool-approval-request` chunk (enabled by `sdk_version=6`). This chunk contains the `approval.id` that your UI uses in `addToolApprovalResponse`.
- When the user clicks Approve or Deny, `addToolApprovalResponse` mutates the client-side message state.
- `sendAutomaticallyWhen={lastAssistantMessageIsCompleteWithApprovalResponses}` detects that all pending approval responses are present and **automatically triggers a new `sendMessage` call**, which sends the full history + approval response to the backend.
- The backend’s `VercelAIAdapter` parses those `approval-responded` parts into `DeferredToolResults` and runs the agent again.

So the “continuation” is not a server-held promise—it is a **new request triggered by the client**, carrying the entire state needed to resume.

### 🧾 Summary correction

| Your assumption                                                              | Reality                                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| One HTTP request persists for the entire duration.                           | **Two (or more) separate HTTP requests**: one to reach the deferred state, another to resume after approval.  |
| The agent waits for the human on the same connection.                        | The agent **ends immediately** upon hitting a deferred tool; the connection closes.                           |
| The server knows when to close because it decides the approval wait is over. | The server closes **when the agent run ends**, which happens deterministically at the deferred tool boundary. |
| Progress is held in server memory during the wait.                           | Progress is held in the **client’s message history**; the server is stateless between runs.                   |
| The user “hopefully approves” and it “reaches” the server.                   | The frontend **actively sends a new request** with `sendAutomaticallyWhen`; it is not a passive wait.         |

Your mental model of the **logic** was right; the **transport mechanics** are the part to adjust. The system is intentionally **stateless and connection-agnostic**, which is what makes it survivable across crashes, timeouts, and scale—the very properties you identified as missing in your previous question.

---

Your manual implementation and the PydanticAI version are functionally similar—both run a loop that calls the LLM, executes tools, and feeds results back. The difference is **what the framework absorbs into maintained infrastructure versus what you hand-rolled**. PydanticAI essentially takes your ~80-line `get_llm_response` loop and replaces it with a declarative agent definition plus a protocol adapter, removing significant boilerplate while introducing a new layer of abstraction to learn.

# What PydanticAI's `Agent` handles that your manual loop handled

Your manual `get_llm_response` function is a hand-rolled agent loop. It does the following, all of which PydanticAI now handles for you:

| Concern                        | Your manual implementation                                                                                                                                                                              | PydanticAI `Agent`                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tool schema generation**     | You called `pydantic_function_tool(ExpenseToolInput, ...)` to generate the JSON schema from your Pydantic model.                                                                                        | PydanticAI introspects the `@agent.tool` decorated function's type hints and docstring to generate the schema automatically.                                                                       |
| **Agent loop**                 | You wrote a `while True` loop, streamed chunks, accumulated `tool_calls` deltas, appended assistant messages, executed tools, appended tool results, and looped again.                                  | The `Agent` runs the loop internally: it calls the model, executes tools, feeds results back, and repeats until the model produces a final structured output or a deferred approval request.       |
| **Tool execution**             | You manually dispatched based on `tc["function"]["name"] == "create_expense"` and parsed the arguments with `json.loads`.                                                                               | Tool dispatch is automatic; PydanticAI parses arguments and validates them against your function signature before calling the tool.                                                                |
| **Validation & retries**       | You had no validation of the LLM's arguments before execution (only a `try/except json.JSONDecodeError`). If the LLM hallucinated a bad enum or missing field, your tool would fail or insert bad data. | PydanticAI validates tool-call arguments against the schema; if validation fails, it automatically sends the error back to the LLM and retries (configurable via `retries={'output': 3}`).         |
| **Human-in-the-loop approval** | You had **no approval mechanism at all**—tools ran immediately.                                                                                                                                         | `@agent.tool(requires_approval=True)` marks the tool as deferred; the agent ends the run with `DeferredToolRequests`, and the approval is resolved via `DeferredToolResults`.                      |
| **Structured output**          | You had no structured output; the LLM's text was streamed raw.                                                                                                                                          | `output_type=[ExpenseToolInput, DeferredToolRequests]` ensures the final output is a validated Pydantic model or a typed deferred request.                                                         |
| **Dependency injection**       | `user_id` was passed as a function argument and threaded through manually.                                                                                                                              | `ctx.deps` provides typed dependency injection into tools, similar to FastAPI's `Depends`.                                                                                                         |
| **Streaming transformation**   | You yielded raw text chunks (`yield delta.content`) and manually accumulated tool-call deltas.                                                                                                          | The `VercelAIAdapter` transforms PydanticAI's internal `AgentStreamEvent` objects into protocol-specific events (text deltas, tool-approval requests, tool results) that the frontend understands. |

A migration report from a real project shows the scale of reduction: they deleted **~2,500 lines** of custom loop, extraction, budget, and context plumbing when moving to PydanticAI.

---

# What is being streamed, and what data structures are exposed?

**In the PydanticAI + Vercel AI SDK implementation**, the stream is a **structured SSE event stream** conforming to the Vercel AI Data Stream Protocol. The `VercelAIAdapter` translates PydanticAI's internal `AgentStreamEvent` objects into **typed UI message parts**:

- **`text`** parts: streamed tokens of the assistant's reply.
- **`tool-create_expense`** parts with states like `"approval-requested"`, `"output-available"`, and `"output-denied"`—these drive the approval UI you built.
- **`tool-approval-request`** and **`tool-approval-response`** chunks (enabled by `sdk_version=6`) that carry the `approval.id` used in `addToolApprovalResponse`.
- The frontend's `useChat` hook reduces these parts into `UIMessage` objects, where each message is a collection of typed parts rather than a flat string.

This is why your frontend code can check `part.type === "tool-create_expense"` and `part.state === "approval-requested"`—those structured states **do not exist** in a `text/plain` stream.

---

# What complexity does the framework remove, and what does it introduce?

**Removed complexity:**

- **Boilerplate tool schema generation**: no more `pydantic_function_tool()` calls; decorators handle it.
- **Manual loop management**: no `while True`, no delta accumulation, no manual message appending.
- **Validation and retry plumbing**: PydanticAI handles schema validation and error-feedback retries automatically.
- **Protocol translation**: the `VercelAIAdapter` converts PydanticAI events into Vercel-compatible SSE chunks, so you don't need to manually encode `text/plain` or design your own event format.
- **Approval gate plumbing**: `requires_approval=True` + `DeferredToolRequests` replaces what would be hundreds of lines of custom pause/resume logic.

**Introduced complexity:**

- **New abstractions to learn**: `Agent`, `RunContext`, `DeferredToolRequests`, `DeferredToolResults`, `UIAdapter`, `AgentStreamEvent`—these are not part of the OpenAI SDK and require reading PydanticAI's docs.
- **Debugging indirection**: when a stream fails, the error may be in your code, in PydanticAI's loop, in the adapter's event transformation, or in the Vercel AI SDK's parsing. Your manual loop had one stack trace; now there are several layers.
- **Version coupling**: the approval flow depends on `sdk_version=6` being correctly set and on PydanticAI's Vercel adapter supporting the approval chunk types. Earlier versions had bugs where `tool-approval-request` chunks were not emitted.
- **Less granular control**: if you need to inspect or mutate the raw stream mid-flight (e.g., for custom logging of every delta), the adapter abstracts that away. You would need to drop down to `Agent.run_stream_events()` or a custom `UIAdapter`.

The trade is standard: **you write less code, but you own less of the execution path.** For a learning project, the manual loop is invaluable because it shows you exactly how function calling works under the hood. For a production app with approvals, retries, and a typed frontend, the framework's abstractions are worth the learning curve—especially since they handle the stateless, multi-run approval flow that would be error-prone to build from scratch.

# Difference between current streamed data and previous streamed data

`useChat` **always** exposes messages as objects with a `parts` array, regardless of transport. The real difference is **what kinds of parts the transport is capable of producing**.

`message.parts.map(...)` was the correct rendering pattern in both versions. The difference is that with `TextStreamChatTransport`, the `parts` array can only ever contain **one kind of part: plain text**. With `DefaultChatTransport`, the `parts` array can contain **structured, typed parts**, including tool-call parts with approval lifecycle states.

### The actual protocol difference

`TextStreamChatTransport` is explicitly designed for **plain-text streaming endpoints**. The AI SDK documentation states that a text stream “contains chunks in plain text” and that “text streams only support basic text data. If you need to stream other types of data such as tool calls, use data streams”. When you use `TextStreamChatTransport`, it “wraps a plain text response in one assistant text part”. So your `parts` array is populated, but it will only ever contain text parts—there is no mechanism in that protocol to represent a tool call, a tool result, or an approval request.

`DefaultChatTransport` uses the **AI SDK data stream protocol**, which is an SSE-based, chunked protocol where each chunk is a JSON event with a type. This protocol defines distinct chunk types for text, tool input, tool output, and tool approval. The lifecycle includes chunks like `text-delta`, `tool-input-available`, `tool-output-available`, `tool-approval-request`, and `tool-approval-response`. Because the transport receives these typed chunks, `useChat` can reduce them into `message.parts` entries with `type: "tool-create_expense"` and states like `"approval-requested"` or `"output-available"`.

### Concrete comparison

|                                      | Earlier version (`TextStreamChatTransport`)                                           | Current version (`DefaultChatTransport`)                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **What the backend sends**           | A raw plain-text byte stream (your `StreamingResponse(..., media_type="text/plain")`) | SSE stream of JSON-encoded UI message chunks (via `VercelAIAdapter`, `sdk_version=6`)     |
| **What `useChat` parses**            | Plain text chunks, appended into a single text part                                   | Typed chunks (`text-delta`, `tool-input-available`, `tool-approval-request`, etc.)        |
| **What `message.parts` contains**    | Only `{ type: "text", text: "..." }`                                                  | `text` parts **plus** `tool-*` parts with `state`, `input`, `output`, `approval.id`, etc. |
| **Can you render tool approval UI?** | **No**—the protocol has no way to express a pending tool call                         | **Yes**—`part.state === "approval-requested"` is available                                |

So your rendering loop (`message.parts.map`) was structurally the same in both versions. What changed is that the **transport protocol** now feeds `useChat` richer, typed chunks, so the `parts` array actually contains tool parts that your current code checks for with `part.type === "tool-create_expense"`.

### Why your earlier `parts.map` still worked

`TextStreamChatTransport` is a compatibility layer: it takes a legacy plain-text stream and wraps it into the modern `UIMessagePart` shape so that `useChat`’s part-based API does not break. That is why your earlier code compiled and rendered text correctly. But it was a **text-only compatibility shim**—it could not represent tool calls, approval requests, or structured outputs. To get those, you have to switch to the data stream protocol via `DefaultChatTransport` (and ensure your backend emits the correct SSE chunks with `sdk_version=6`).

I appreciate the correction—it makes the architectural point clearer: the transport determines the **expressive power** of the stream, while `message.parts` is just the common UI shape that both transports populate to different degrees.
