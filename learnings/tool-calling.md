# What is a generator?

A **generator** is a special kind of function that produces values **one at a time, lazily**, instead of computing one big result and returning it all at once.

The magic ingredient is the `yield` keyword (instead of `return`).

## The simplest possible example

```python
def count_to_three():
    yield 1
    yield 2
    yield 3

for n in count_to_three():
    print(n)
```

Output:

```
1
2
3
```

The key difference from a normal function:

| Normal function                                       | Generator function                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `return x` → hands back a value, **function is dead** | `yield x` → hands back a value, **function pauses** and remembers where it was |
| You get the whole result at once                      | You get results **as they are produced**                                       |
| `result = f()`                                        | `for x in f():` or `next(f)`                                                   |

When the generator is asked for the _next_ value, it resumes exactly where it paused. It only runs up to the next `yield`, then pauses again. When the function finishes (falls off the end, or hits `break`/`return`), the generator is "exhausted."

This is called **lazy evaluation**: you only compute a value at the moment someone asks for it.

## Why generators are useful

1. **Streaming / real-time output** – you can hand data to the consumer the instant it's available.
2. **Memory** – you never need to build a huge list in memory; values are produced on demand.
3. **Infinite streams** – a generator can (in principle) `yield` forever, which a list can't.

## Your function: an _async_ generator

Now look at your function's signature:

```python
async def get_llm_response(...) -> AsyncGenerator[str, None]:
```

- `async def` → it's asynchronous (uses `await` inside).
- `yield` inside → it's a generator.
- Together: **an async generator**.

An async generator is consumed with `async for`, not `for`:

```python
async for chunk in get_llm_response(prompt, user_id):
    # do something with each chunk, e.g. send it to the browser
    await send_to_frontend(chunk)
```

`AsyncGenerator[str, None]` just means: "this yields `str` values, and it doesn't accept values sent back into it" (the `None` part — you can ignore that for now).

## What it does in _your_ code

The important lines are:

```python
async for chunk in stream:
    ...
    yield delta.content   # ← stream text to the frontend as it arrives
```

The LLM's response arrives in **chunks** (little pieces of text). Instead of collecting all the pieces into a list and returning at the very end, the function `yield`s each piece **immediately** as it arrives.

So the flow is:

```
LLM stream:  "Here"  → " is"  → " your"  → " expense"  → ...
                │         │         │            │
yield ──────────┘         │         │            │
yield ────────────────────┘         │            │
yield ──────────────────────────────┘            │
yield ───────────────────────────────────────────┘
                          ↓
          whoever is consuming the generator
          (e.g. a FastAPI endpoint streaming to the browser)
          gets each piece in real time
```

That's why it "streams to the frontend" — the user sees words appear as the model generates them, rather than staring at a spinner until the whole answer is ready.

## TL;DR

> A generator is a function that **hands you values one at a time and pauses between them** (via `yield`), instead of returning one finished value. `async def` + `yield` makes it an **async generator**, consumed with `async for`. Your `get_llm_response` uses this to **stream the LLM's output piece by piece** to the frontend as it's generated.

# 1. What is a "stream"?

A **stream** is a sequence of pieces of data delivered **over time**, instead of all at once.

Two analogies:

- **Non-streaming (a bucket):** the server fills a bucket with water, then hands you the whole bucket. You can't drink until it's full.
- **Streaming (a hose):** the server turns on a hose. Water arrives continuously. You can drink the first sip immediately while the rest is still coming.

For your `/llm` endpoint:

- **Non-streaming:** the LLM writes a whole answer (say 5 seconds), the server waits, then sends you the whole string in one response. The chat feels frozen for 5 seconds, then "pops" the full message.
- **Streaming:** the LLM writes one word, the server sends it. Then the next word. Then the next. The chat renders words _as the LLM thinks them_, like ChatGPT does.

The stream in your case is a stream of **strings** (text pieces). It could just as well be a stream of rows (a database cursor), a stream of file bytes (an image download), or a stream of log lines (like `kubectl logs -f`).

At the HTTP level, streaming is implemented with **chunked transfer encoding** (HTTP/1.1). Normally a response has a `Content-Length` header that says "the body is exactly N bytes." Streaming responses don't know the length in advance, so they use `Transfer-Encoding: chunked` instead, meaning "I'll send the body in chunks as I produce them, and I'll tell you when I'm done."

---

# 2. `StreamingResponse` vs a normal JSON return

## What a normal return does

```python
@app.get("/health/")
async def health():
    return {"message": "Server running"}
```

FastAPI does three things:

1. Converts the dict to JSON (`{"message":"Server running"}`).
2. Sets headers: `Content-Type: application/json`, `Content-Length: 28`.
3. Sends **everything in one shot**, then closes the connection.

Client side: `fetch()` waits for the entire body, then you call `await response.json()`. Until the whole body has arrived, `response.json()` has nothing to parse.

## What `StreamingResponse` does

```python
return StreamingResponse(
    get_llm_response(user_text, user_id),
    media_type="text/plain",
)
```

FastAPI does:

1. Sets headers: `Content-Type: text/plain`, **no `Content-Length`**, `Transfer-Encoding: chunked`.
2. Starts iterating over `get_llm_response(...)` — that's why it's a **generator**.
3. Every time the generator `yield`s a string, FastAPI converts it to bytes and sends it **immediately** over the same open connection.
4. When the generator finishes (function returns), FastAPI closes the response.

`media_type="text/plain"` only sets the `Content-Type` header — it doesn't make anything "stream". **The streaming comes from the fact that you passed an iterator/generator** instead of a dict. If you passed a plain string, `StreamingResponse` would send it as one chunk and close — technically still "chunked", but no visible difference.

## What happens between client and server, step by step

```
┌───────────┐                                ┌───────────────┐
│ Browser   │                                │ FastAPI       │
└─────┬─────┘                                └───────┬───────┘
      │  POST /llm  {json body}                      │
      ├─────────────────────────────────────────────►│
      │                                              │
      │  ◄── 201 + headers + first text chunk ───────┤  (Groq started streaming)
      │  ◄── next chunk ─────────────────────────────┤  (word by word)
      │  ◄── next chunk ─────────────────────────────┤
      │  ◄── …                                       │
      │  ◄── final chunk + connection closed ────────┤
      ▼                                              ▼
```

The HTTP request is **not finished** until the last chunk arrives. From the browser's point of view, the network request is "in flight" the whole time the LLM is generating. You don't get a "response" object with a `.json()` method — you get a **readable body stream** you can read chunk by chunk.

That's why in your `chat.tsx` you're using `TextStreamChatTransport` — it knows how to consume that stream and feed it to `useChat`, which appends text to the assistant message as it arrives.

---

# 3. How to investigate it in the browser

You have several tools. Do them in order.

## A. Chrome / Edge DevTools → Network tab

1. Open DevTools (`F12` or `Cmd+Opt+I`).
2. Go to the **Network** tab.
3. Send a message in your chat that will trigger a long LLM reply (e.g., "Write 200 words about expenses").
4. Watch the `/llm` request in the list. It will **stay in "Pending"** status the whole time the LLM is generating — that's the visual proof it's streaming. A normal JSON response shows `200` almost immediately, even before you open the response body.
5. Click on the `/llm` request and look at:
   - **Headers** tab → find `Transfer-Encoding: chunked` (no `Content-Length`). This is the tell.
   - **Response** tab → you'll see the body **grow as you watch**. That is literally the chunks arriving. If you clicked too late, reload and click the request while it's still pending.
   - **Timing** tab → notice a long bar labelled **"Content Download"** or **"Receiving"** — that's how long the stream stayed open. A normal JSON response's "Content Download" is tiny.

Note: the **EventStream** tab only appears for `Content-Type: text/event-stream` (Server-Sent Events, what ChatGPT-style APIs often use). Your endpoint is `text/plain`, so you won't see that tab — this is normal, not a bug.

## B. Side-by-side mental model

Put the two sides next to each other:

| Server (Python)                    | Client (JS)                               |
| ---------------------------------- | ----------------------------------------- |
| `yield "Hello"`                    | `const { value } = await reader.read()`   |
| `yield " world"`                   | → `" world"` arrives after the first read |
| `yield "!"`                        | → `"!"` arrives after the second read     |
| (function returns → response ends) | `{ done: true }` → `break`                |

Every `yield` on the server has a corresponding `read()` on the client. That's the whole protocol.

---

# TL;DR

- **Stream** = data delivered piece by piece over time, like a hose, not a bucket.
- **Normal `return`** = FastAPI sends one JSON blob with a `Content-Length`, connection closes; `response.json()` in JS.
- **`StreamingResponse(generator, ...)`** = no `Content-Length`, `Transfer-Encoding: chunked`; FastAPI iterates your generator and sends each `yield` as a chunk; connection stays open until the generator finishes.
- **How to verify:** `curl -N` in the terminal (simplest), or DevTools → Network → click `/llm` → watch "Response" grow + "Timing → Content Download" bar be long. For finer control, use `res.body.getReader()` in the browser console and `console.log` each chunk.

# Understanding `get_llm_response`, piece by piece

This function is the "brain" of your tool calling. It's longer than the others because it does three jobs at once: **talk to the LLM, watch for tool requests, and stream text back to the browser**. Let's break it down.

I'll start with the big picture, then walk through it line by line, then explain the two Python features that will feel new.

---

## The big picture: a conversation loop

Here's the whole idea in plain English:

1. Send the user's message to the LLM.
2. The LLM replies **in pieces** (a stream). Some pieces are text ("I'll record that expense…"), some pieces are tool requests ("call `create_expense` with these arguments").
3. **Yield** any text pieces straight to the browser as they arrive — that's what makes it feel live.
4. Also **collect** those pieces so we can reconstruct what the LLM said.
5. When the stream ends, check: did the LLM ask for any tools?
   - **No** → we're done. Break out of the loop.
   - **Yes** → run each tool, append the results to the conversation history, then **loop back** and call the LLM again so it can react to those results.
6. Repeat until the LLM produces a final answer with no tool calls.

That's the loop. Everything else is bookkeeping.

---

## Line-by-line walkthrough

### The signature

```python
async def get_llm_response(prompt: str, user_id: str) -> AsyncGenerator[str, None]:
```

- `async def` means **async function** — it can `await` things (like network calls) without blocking the server. This is what makes streaming possible: while waiting for the next chunk from Groq, your server can serve other requests.
- `-> AsyncGenerator[str, None]` is just a type hint (Python ignores it at runtime). It tells you: "this function produces a stream of strings." We'll come back to that.
- It takes the user's text (`prompt`) and the authenticated `user_id` (needed to insert rows into `expenses`).

### Building the conversation history

```python
messages = [
    {"role": "system", "content": "You are a helpful expense parsing assistant..."},
    {"role": "user",   "content": prompt},
]
```

`messages` is a **list of dictionaries**. Each dictionary is one "turn" in the conversation. The LLM is stateless — it only knows what's in this list. So every time we call it, we send the whole list.

You'll notice this list **grows** inside the loop. That's the whole trick: each loop iteration adds the assistant's tool request and the tool's result, so the next call has more context.

### The outer loop

```python
while True:
```

`while True:` means "loop forever." We control when to exit — inside the loop, via `break`.

We need a loop here because one HTTP request from the browser may require **multiple LLM calls**:

- Call 1 → LLM says "I want to call a tool"
- Call 2 → LLM sees the tool result and says "Great, expense recorded"

Two calls. One loop iteration each. Without the `while`, you'd only ever do the first.

### Calling the LLM (streaming mode)

```python
stream = await client.chat.completions.create(
    model="openai/gpt-oss-120b",
    messages=messages,
    tools=[expense_tool],
    temperature=0.2,
    stream=True,
)
```

- `await` = "start this task; pause until it returns." The function `create(...)` is async, so it must be awaited.
- `tools=[expense_tool]` is what makes tool calling possible. It tells Groq: "here are the tools this assistant is allowed to use."
- `stream=True` means: **don't wait for the full reply.** Return an object (`stream`) that you can iterate over, receiving pieces as they're generated.

### Two containers for what comes back

```python
content_parts = []
tool_calls = {}
```

- `content_parts` is a **list of strings**. Every text piece the LLM sends goes here, so at the end we can join them back into the full message.
- `tool_calls` is a **dictionary** (a map from `index` to tool call info). We'll see why it's keyed by index in a moment.

Both are **reset each loop iteration** — they represent only the current LLM response.

### Reading the stream

```python
async for chunk in stream:
```

- `async for` iterates over something that arrives over time (an **async iterator**).
- Each `chunk` is a small piece of the reply. You'll get hundreds of them per response.

```python
delta = chunk.choices[0].delta
```

- Every chunk has a `choices` list (the OpenAI API can return multiple replies; we asked for one, so `[0]`).
- `delta` means "the _change_ since the last chunk." This is the piece we care about.

### When the delta is text

```python
if delta.content:
    content_parts.append(delta.content)
    yield delta.content
```

- If `delta.content` isn't empty, it's a text piece (e.g., `"I'll "`, `"record "`, `"that."`).
- `content_parts.append(...)` stores it for later.
- `yield delta.content` **sends it to the browser immediately.** This is the key to live streaming.

### When the delta is a tool call

```python
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
```

This is the trickiest part, so read carefully.

**The problem:** when the LLM wants to call a tool, it streams the call **in pieces**, exactly like it streams text. The arguments come as fragments:

```
chunk 1: tool_calls[0].function.name = "create_expense", arguments = '{"'
chunk 2: arguments = 'date"'
chunk 3: arguments = ': "2025-'
chunk 4: arguments = '10-31"'
...
```

No single chunk contains the full JSON. You must **reassemble** it.

**The solution:** build a dictionary keyed by `index`.

- `tc.index` is `0` for the first tool call, `1` for the second, etc. (The LLM could request multiple tools in one turn.)
- **First time** we see `idx`: create a fresh entry with the tool's `id`, `name`, and an **empty** `arguments` string.
- **Every time** we see arguments: **append** the fragment to the existing string (`+=`).

At the end of the stream, `tool_calls[0]["function"]["arguments"]` will be the complete JSON like `{"date": "2025-10-31", "merchant": "Blue Bottle", ...}`, ready to parse.

### Deciding whether to loop

```python
if not tool_calls:
    break
```

- If `tool_calls` is empty, the LLM just answered in text. Nothing more to do. **Break** out of `while True` and end the function.
- If `tool_calls` is non-empty, we have tools to run. Fall through to the code below.

### Recording the LLM's request in history

```python
messages.append({
    "role": "assistant",
    "content": "".join(content_parts) or None,
    "tool_calls": list(tool_calls.values())
})
```

We must **add the LLM's response to history** before we add tool results — otherwise the next call won't know _what_ tool request the results belong to.

- `"".join(content_parts)` glues all the text pieces into one string. It might be `""` if the LLM sent no text at all.
- `or None` is a Python idiom: `"" or None` returns `None` (because `""` is "falsy"). The API prefers `None` over `""` here.
- `list(tool_calls.values())` turns `{0: {...}, 1: {...}}` into `[{...}, {...}]` — the format the API expects.

### Running the tools

```python
for tc in tool_calls.values():
    if tc["function"]["name"] == "create_expense":
        try:
            arguments = json.loads(tc["function"]["arguments"])
        except json.JSONDecodeError as e:
            arguments = {}
            tool_result = f"Error parsing arguments: {e}"
        else:
            tool_result = await execute_create_expense(user_id, arguments)

        messages.append({
            "role": "tool",
            "tool_call_id": tc["id"],
            "content": tool_result
        })
```

For each tool call:

1. **Match the tool by name.** You might have several tools eventually; here there's just one.
2. **Parse the arguments.** The LLM gives you a JSON _string_; `json.loads` turns it into a Python dict. This can fail if the model hallucinated malformed JSON — hence the `try/except`.
3. **Run the actual function.** `execute_create_expense` is your code that inserts into Supabase.
4. **Append the result to history** with role `"tool"`. The `tool_call_id` links the result to the specific call — this is how the model knows _which_ tool call this result answers.

The `try/except/else` structure means:

- `try` runs first.
- If it raises → `except` handles the error (falls back to `arguments = {}`).
- If `try` succeeds → `else` runs (this is the normal path — call the DB).

### Looping back

There's no `continue` or `break` at the bottom. After appending tool results, the `while True` naturally loops back to the top, which means:

- **New `content_parts = []` and `tool_calls = {}`** (fresh containers for the next response).
- **New LLM call** with `messages` including the tool results.
- The LLM now sees what the tool returned and can produce a final answer.

If _that_ response is just text with no tool calls → `break` → function ends. The loop is finally over.

---

## The two Python features you probably haven't seen before

### 1. `yield` makes this a "generator"

A normal function **returns once** and is done:

```python
def add(a, b):
    return a + b
```

A **generator** has `yield` and can produce **many values over time**:

```python
def count():
    yield 1
    yield 2
    yield 3
```

Each `yield` pauses the function, hands one value to the caller, and waits to be resumed. The caller typically iterates:

```python
for n in count():
    print(n)  # 1, then 2, then 3
```

**Why this matters:** `StreamingResponse(get_llm_response(...), ...)` in FastAPI calls your function, **and each time it hits `yield`, sends those bytes to the browser.** That's how text appears progressively in your chat UI instead of all at once.

### 2. `async` + `yield` = async generator

Add `async` and now `yield` can coexist with `await`:

```python
async def stream_from_network():
    async for chunk in some_network_stream:
        yield chunk
```

Between every `yield`, Python can `await` — which lets the server handle **other** requests while yours is waiting for the next chunk from Groq. Without `async`, a slow LLM response would freeze your whole server.

Your `get_llm_response` is an async generator. FastAPI's `StreamingResponse` knows how to drive it: call the function, `await` each yielded value, send it downstream, repeat.

---

## Two mental models to keep

**Model 1 — the loop is a ping-pong game.**

- Round 1: You → LLM → LLM says "call tool" → you run tool.
- Round 2: You → LLM (with tool result) → LLM says "done" → loop exits.
- Every round appends to `messages`, so the LLM remembers.

**Model 2 — streaming is assembly-line.**

- The LLM doesn't send you a finished message; it sends you parts.
- You **stream text parts straight through** (the `yield`) and **accumulate every part** (into `content_parts` and `tool_calls`) so you can reconstruct the full picture when the stream ends.

Once both models click, the code reads naturally: "read the stream → what did we get? → if tool, run it and loop → if text, we're done."

One thing worth adding while you're learning — a few `print` statements so you can _see_ the loop working:

```python
print(f"[loop] messages: {len(messages)} turns")
print(f"[stream] got {len(content_parts)} text pieces, {len(tool_calls)} tool calls")
```

Watch them appear twice the first time you send a message that triggers `create_expense`. Two iterations = one tool call. That's the "aha" moment.
