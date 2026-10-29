"use client";

// https://chat.deepseek.com/a/chat/s/90808de7-c8d4-4719-bb84-989412e5f1af
// https://www.kimi.ai/chat/1a16b763-3982-8c24-8000-09ba29a5ca60

import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useState } from "react";
import { DefaultChatTransport, TextStreamChatTransport } from "ai";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase";

function ChatApp() {
  const [input, setInput] = useState("");
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "http://localhost:8000/llm",
        fetch: async (input, init) => {
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) throw new Error("Not authenticated");

          return fetch(input, {
            ...init,
            headers: {
              ...init?.headers,
              Authorization: `Bearer ${session.access_token}`,
            },
          });
        },
      }),
    [],
  );

  // 2. Initialize useChat using the modern transport pattern
  const { messages, sendMessage, error } = useChat({
    transport,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    // Send the message as structured text parts
    sendMessage({ text: input });
    setInput(""); // Clear input
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setUser(data.user);
      setAuthLoading(false);
    });
  }, []);

  console.log(messages);
  console.log(user);

  if (authLoading) return <h1>Auth Loading...</h1>;

  if (!user) return null;

  return (
    <>
      <div className="flex w-full h-full relative">
        <main className="flex-1 flex flex-col h-full min-w-0 relative bg-gpt-main">
          <div
            id="messages-container"
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6"
          >
            <div id="messages-list" className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-100 ml-auto"
                      : "bg-gray-100"
                  } max-w-[80%]`}
                >
                  <div className="font-semibold text-xs text-gray-500 uppercase mb-1">
                    {message.role === "user" ? "User" : "AI"}
                  </div>

                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <p key={index} className="text-black">
                          {part.text}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 bg-gpt-main/90 backdrop-blur border-t border-transparent shrink-0">
            <div className="max-w-3xl mx-auto relative">
              <form
                id="chat-form"
                className="relative bg-gpt-input rounded-2xl border border-gpt-border focus-within:border-gray-500 shadow-xl transition-all"
                onSubmit={handleSubmit}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  id="user-input"
                  //   rows={1}
                  placeholder="Message Expense GPT..."
                  className="w-full bg-transparent text-gray-100 placeholder-gray-400 px-4 pt-3.5 pb-12 resize-none focus:outline-none max-h-48 text-sm md:text-base leading-relaxed"
                ></input>
              </form>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default ChatApp;

{
  /* 

        <aside
          id="sidebar"
          className="w-64 bg-gpt-sidebar flex flex-col h-full border-r border-gpt-border transition-all duration-300 z-30 shrink-0"
        >
          <div className="p-3 flex items-center justify-between gap-2">
            <button
              id="new-chat-btn"
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium hover:bg-gpt-card transition-colors text-gray-200 border border-gpt-border"
            >
              <i data-lucide="square-pen" className="w-4 h-4"></i>
              <span>New chat</span>
            </button>
            <button
              id="close-sidebar-btn"
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gpt-card md:hidden"
            >
              <i data-lucide="panel-left-close" className="w-5 h-5"></i>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Today
              </div>
              <div id="chat-history-list" className="space-y-1 mt-1"></div>
            </div>
          </div>
          <div className="p-2 border-t border-gpt-border">
            <button
              id="user-menu-btn"
              className="flex items-center gap-3 w-full p-2 hover:bg-gpt-card rounded-lg transition-colors text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center font-medium text-white text-sm shrink-0">
                AI
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-200 truncate">
                  Developer Account
                </div>
                <div className="text-xs text-gray-400 truncate">Pro Plan</div>
              </div>
              <i
                data-lucide="ellipsis"
                className="w-4 h-4 text-gray-400 group-hover:text-gray-200 shrink-0"
              ></i>
            </button>
          </div>
        </aside>
    
*/
}

{
  /*          
            <div
              id="welcome-screen"
              className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-4"
            >
              <div className="w-12 h-12 rounded-full bg-gpt-card border border-gpt-border flex items-center justify-center mb-4 shadow-inner">
                <i data-lucide="bot" className="w-6 h-6 text-emerald-400"></i>
              </div>
              <h1 className="text-2xl font-semibold mb-2">Expense GPT</h1>
              <p className="text-gray-400 text-sm mb-8">Provide expenses</p>
            </div>
*/
}
