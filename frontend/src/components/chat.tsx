"use client";

// https://chat.deepseek.com/a/chat/s/90808de7-c8d4-4719-bb84-989412e5f1af
// https://www.kimi.ai/chat/1a16b763-3982-8c24-8000-09ba29a5ca60

import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useState } from "react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useRouter } from "next/navigation";
import { CircleCheckIcon, LoaderCircleIcon, TerminalIcon } from "lucide-react";

import { createClient } from "@/lib/supabase";
import PromptInput, { AttachmentFile } from "@/components/prompt-input";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
  TraceIcon,
} from "@/components/ui/trace";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";

function ReasoningRow({
  text,
  running,
  defaultOpen,
}: {
  text: string;
  running: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const line = (
    <TraceLine status={running ? "running" : undefined}>
      <TraceTitle>{running ? "Thinking" : "Thought for 5s"}</TraceTitle>
    </TraceLine>
  );

  if (text.length === 0) {
    return line;
  }

  return (
    <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="whitespace-pre-wrap">
        {text}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

function ChatApp() {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
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
  const { messages, sendMessage, error, status, addToolApprovalResponse } =
    useChat({
      transport,
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  const busy = status === "submitted" || status === "streaming";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    // Send the message as structured text parts
    sendMessage({ text: input });
    setInput(""); // Clear input
    setFiles([]);
  };

  function onAttach(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files;
    if (!selected) {
      return;
    }

    setFiles((current) => [
      ...current,
      ...Array.from(selected, (file) => ({
        id: crypto.randomUUID(),
        name: file.name,
      })),
    ]);
    event.target.value = "";
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setUser(data.user);
      setAuthLoading(false);
    });
  }, []);

  console.log(messages);
  console.log(error);

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
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => {
                if (message.role === "user") {
                  return (
                    <Message key={message.id} align="end">
                      <MessageContent>
                        <Bubble align="end" variant="muted">
                          <BubbleContent>
                            <>
                              {message.parts.map((part, index) => {
                                if (part.type === "text") {
                                  return part.text;
                                }
                              })}
                            </>
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  );
                }

                return (
                  <Message key={message.id}>
                    <MessageContent className="gap-4">
                      {message.parts.map((part, index) => {
                        const streaming = busy && message === messages.at(-1);

                        // if (part.type === "text") {
                        //   return <p key={index}>{part.text}</p>;
                        // }

                        if (part.type === "reasoning") {
                          return (
                            <ReasoningRow
                              key={index}
                              text={part.text}
                              running={streaming && part.state === "streaming"}
                              defaultOpen={busy ? undefined : true}
                            />
                          );
                        }

                        if (part.type === "tool-create_expense") {
                          if (part.state === "approval-requested") {
                            return (
                              <Item
                                key={part.toolCallId}
                                variant="outline"
                                size="sm"
                                className="flex-col items-stretch gap-3"
                              >
                                <div className="flex items-center gap-2">
                                  <ItemMedia variant="icon">
                                    <TerminalIcon />
                                  </ItemMedia>
                                  <ItemContent>
                                    <ItemTitle>
                                      Confirm expense to be saved?
                                    </ItemTitle>
                                  </ItemContent>
                                </div>

                                <CodeBlock className="w-full">
                                  <CodeBlockHeader>
                                    <CodeBlockTitle>Expense(s)</CodeBlockTitle>
                                  </CodeBlockHeader>
                                  <CodeBlockContent lang="json" lineNumbers>
                                    {JSON.stringify(part.input, null, 2)}
                                  </CodeBlockContent>
                                </CodeBlock>

                                <ItemActions>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      addToolApprovalResponse({
                                        id: part.approval.id,
                                        approved: false,
                                      })
                                    }
                                  >
                                    Deny
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      addToolApprovalResponse({
                                        id: part.approval.id,
                                        approved: true,
                                      })
                                    }
                                  >
                                    Approve
                                  </Button>
                                </ItemActions>
                              </Item>
                            );
                          }

                          if (
                            part.state === "output-available" ||
                            part.state === "output-denied"
                          ) {
                            const denied = part.state === "output-denied";

                            return (
                              <Trace key={part.toolCallId}>
                                <TraceLine
                                  status={
                                    !denied && part.state !== "output-available"
                                      ? "running"
                                      : undefined
                                  }
                                >
                                  <TraceIcon>
                                    <TerminalIcon />
                                  </TraceIcon>
                                  <TraceTitle>
                                    {denied ? (
                                      "Denied"
                                    ) : part.state === "output-available" ? (
                                      <div>
                                        <CodeBlock className="w-full">
                                          <CodeBlockHeader>
                                            <CodeBlockTitle>
                                              Saved
                                            </CodeBlockTitle>
                                          </CodeBlockHeader>
                                          <CodeBlockContent
                                            lang="json"
                                            lineNumbers
                                          >
                                            {JSON.stringify(
                                              part.input?.expenses ?? [],
                                              null,
                                              2,
                                            )}
                                          </CodeBlockContent>
                                        </CodeBlock>
                                      </div>
                                    ) : (
                                      "Running"
                                    )}{" "}
                                  </TraceTitle>
                                </TraceLine>
                              </Trace>
                            );
                          }
                        }

                        if (part.type === "tool-final_result") {
                          return <p key={index}>{part.output}</p>;
                        }
                      })}
                    </MessageContent>
                  </Message>
                );
              })}
            </div>
          </div>

          <PromptInput
            files={files}
            handleTextChange={(val) => setInput(val)}
            onAttach={onAttach}
            onSubmit={handleSubmit}
            text={input}
          />
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
