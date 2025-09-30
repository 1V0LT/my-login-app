"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "system" | "user" | "assistant";
type Message = {
  id: string;
  role: Role;
  content: string;
  createdAt: number; // epoch ms
};

const LS_KEY = "chatMessages";

function uuid() {
  const c = (globalThis as unknown as {
    crypto?: { randomUUID?: () => string };
  }).crypto;
  const rnd = c?.randomUUID?.();
  if (rnd) return rnd;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Convert conversation history into a prompt format for Ollama (keeps current backend behavior)
  const buildConversationPrompt = (msgs: Pick<Message, "role" | "content">[]): string => {
    return msgs
      .map((msg) => {
        switch (msg.role) {
          case "system":
            return `System: ${msg.content.trim()}`;
          case "user":
            return `User: ${msg.content.trim()}`;
          case "assistant":
            return `Assistant: ${msg.content.trim()}`;
          default:
            return msg.content.trim();
        }
      })
      .join("\n\n");
  };

  const sendPrompt = async (customPrompt?: string, skipUserMessage = false) => {
    const userMessage = (customPrompt ?? prompt).trim();
    if (!userMessage || isLoading) return;

    setError(null);

    // Add user message locally if it's a real input
    let nextMessages = messages;
    if (!skipUserMessage) {
      const newMsg: Message = {
        id: uuid(),
        role: "user",
        content: userMessage,
        createdAt: Date.now(),
      };
      nextMessages = [...messages, newMsg];
      setMessages(nextMessages);
    }

    if (!customPrompt) setPrompt("");

    // Prepare conversation text
    const conversationText = buildConversationPrompt(
      !skipUserMessage
        ? nextMessages.map(({ role, content }) => ({ role, content }))
        : [
            ...messages.map(({ role, content }) => ({ role, content })),
            { role: "user", content: userMessage },
          ]
    );

    // Send to backend
    try {
      setIsLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: conversationText }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errText = "Unknown error";
        try {
          const errData = await res.json();
          errText = errData?.error ?? errText;
        } catch {}
        setError(errText);
        setMessages((prev) => [
          ...prev,
          {
            id: uuid(),
            role: "assistant",
            content: `Error: ${errText}`,
            createdAt: Date.now(),
          },
        ]);
        return;
      }

      const data = (await res.json()) as { response?: string };
      const text = (data.response ?? "No response").trim();

      setMessages((prev) => [
        ...prev,
        { id: uuid(), role: "assistant", content: text, createdAt: Date.now() },
      ]);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Generation cancelled");
        return;
      }
      console.error("Error calling /api/ollama:", err);
      setError("Something went wrong.");
      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: "assistant",
          content: "Something went wrong.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendPrompt();
    }
  };

  // Auto-grow textarea
  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(160, el.scrollHeight) + "px"; // cap height
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Persist to localStorage
  useEffect(() => {
    try {
      const toSave = JSON.stringify(messages);
      localStorage.setItem(LS_KEY, toSave);
    } catch {}
  }, [messages]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {}
  }, []);

  // Automatically start the interview on a fresh chat
  useEffect(() => {
    if (messages.length === 0) {
      void sendPrompt(
        `You are an AI interviewer for a Software Development position.
        You must introduce yourself with a random name and mention a random tech company name ONLY ONCE at the very start. After that, do not re-introduce yourself.

        Guidelines:
        1. Start with a single introduction, then proceed as if you're conducting a real interview.
        2. Ask exactly 3 software-development-related questions.
        3. Assess the candidate's answers, offering short feedback.
        4. At the end only, give the candidate a rating out of 10 with final remarks.
        5. Stay polite, professional, and consistent.
        6. Do not allow mistakes to go unnoticed.
        7. Do not add notes or comments outside the interview context.
        8. When i tell you my name greet me with it, then ask questions.
        9. Do not put your emotions in ** since you have to act like a real human
        10. Do not allow the candidate to use slang or informal language.
        11. Keep 20 to 30 words per message STRICYLY.
        12. If the candidate asks to change the topic, politely decline and steer back to the interview.
        \nBegin the interview.`,
        true
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const clearChat = async () => {
    // Reset server chat as well
    try {
      await fetch("/api/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
    } catch {}
    setMessages([]);
    setPrompt("");
    setError(null);
  };

  const exportChat = () => {
    const lines = messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        const ts = new Date(m.createdAt).toLocaleString();
        const who = m.role === "user" ? "You" : "Assistant";
        return `[${ts}] ${who}:\n${m.content}\n`;
      })
      .join("\n");
    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-transcript-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const headerSubtitle = useMemo(
    () => (isLoading ? "Assistant is typing…" : "Model: llama3.2"),
    [isLoading]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div className="mx-auto max-w-4xl h-screen flex flex-col px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">AI Interviewer</h1>
            <p className="text-xs sm:text-sm text-slate-500">{headerSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearChat}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              title="Start new chat"
            >
              New
            </button>
            <button
              onClick={exportChat}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              title="Export transcript"
            >
              Export
            </button>
            {isLoading ? (
              <button
                onClick={stopGeneration}
                className="inline-flex items-center gap-2 rounded-md bg-rose-500 px-3 py-1.5 text-sm text-white hover:bg-rose-600"
                title="Stop response"
              >
                Stop
              </button>
            ) : null}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 sm:p-4"
        >
          {messages.length === 0 ? (
            <div className="mx-auto max-w-md text-center text-slate-500 py-10">
              <p className="font-medium">Welcome! Starting your interview…</p>
              <p className="text-sm">You can answer questions or ask for clarification.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages
                .filter((m) => m.role !== "system")
                .map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      {/* Avatar */}
                      <div
                        className={`h-8 w-8 shrink-0 aspect-square flex items-center justify-center rounded-full text-xs font-medium ${
                          msg.role === "user" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                        title={msg.role === "user" ? "You" : "Assistant"}
                      >
                        {msg.role === "user" ? "You" : "AI"}
                      </div>
                      {/* Bubble */}
                      <div
                        className={`group relative rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-900"
                        }`}
                      >
                        {msg.content}
                        <div className="mt-1 text-[10px] opacity-70">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {/* Copy button */}
                        <button
                          onClick={() => copyMessage(msg.content)}
                          className="absolute -top-2 -right-2 hidden rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-600 shadow-sm group-hover:block"
                          title="Copy"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex w-full justify-start">
                  <div className="flex items-end gap-2 max-w-[85%]">
                    <div className="h-8 w-8 shrink-0 aspect-square flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                      AI
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700">
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce [animation-delay:-0.3s]">•</span>
                        <span className="animate-bounce [animation-delay:-0.15s]">•</span>
                        <span className="animate-bounce">•</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              className="min-h-[44px] max-h-40 w-full resize-none rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type your response… (Shift+Enter for new line)"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                autoGrow();
              }}
              onKeyDown={handleKeyDown}
              onInput={autoGrow}
              disabled={isLoading}
            />
            <button
              onClick={() => sendPrompt()}
              disabled={!prompt.trim() || isLoading}
              className="inline-flex select-none items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-slate-500">
            <span>Press Enter to send • Shift+Enter for newline</span>
            <button
              onClick={clearChat}
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              title="Clear chat"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
