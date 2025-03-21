"use client";

import { useState, useEffect, useRef } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState<
    { role: "system" | "user" | "assistant"; content: string }[]
  >([]);

  const [prompt, setPrompt] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Convert conversation history into a prompt format for Ollama
  const buildConversationPrompt = (
    msgs: { role: string; content: string }[]
  ): string => {
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
      .join("\n\n"); // separate with blank lines
  };

  const sendPrompt = async (customPrompt?: string, skipUserMessage = false) => {
    const userMessage = customPrompt || prompt.trim();
    if (!userMessage) return;

    if (!skipUserMessage) {
      // Add user message to chat history (only if it's a real user input)
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    }

    // Clear input field if it's a manual user input
    if (!customPrompt) setPrompt("");

    try {
      // Prepare chat history as input for AI
      const updatedMessages = [...messages, { role: "user", content: userMessage }];
      const conversationText = buildConversationPrompt(updatedMessages);

      // Send conversation to Ollama
      const res = await fetch("/api/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: conversationText }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${errData.error}` },
        ]);
        return;
      }

      const data = await res.json();

      // Append assistant response
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response || "No response" },
      ]);
    } catch (err) {
      console.error("Error calling /api/ollama:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong." },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  };

  // Scroll to the bottom of the chat on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // 🔹 Automatically start the interview (without user input)
  useEffect(() => {
    if (messages.length === 0) {
      sendPrompt(
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
        11. Keep 30 to 60 words per message.
        
        Begin the interview.`,
        true // 🔹 Prevent user message from appearing
      );
    }
  }, []); // Runs only once on first render

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-black p-6">
      <div className="w-full max-w-3xl bg-white p-6 rounded shadow flex flex-col h-[80vh]">
        <h1 className="text-2xl font-bold mb-4 text-blue-600 text-center">
          Chat with the AI Interviewer
        </h1>

        {/* Chat messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 border border-gray-300 rounded p-4 mb-4 overflow-y-auto bg-gray-50"
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-2 p-3 rounded-lg max-w-[80%] ${
                msg.role === "user"
                  ? "bg-blue-100 text-blue-900 self-end float-right clear-both text-right"
                  : "bg-gray-200 text-gray-800 self-start float-left clear-both text-left"
              }`}
            >
              <strong>
                {msg.role === "user" ? "You: " : "Bot: "}
              </strong>
              {msg.content}
            </div>
          ))}
        </div>

        {/* Prompt Input */}
        <div className="flex gap-2 items-center">
          <textarea
            className="border flex-1 rounded px-3 py-2 h-14 resize-none"
            placeholder="Type your response here... (Shift+Enter for new line)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={() => sendPrompt()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
