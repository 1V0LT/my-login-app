"use client";

import { useState } from "react";

export default function ChatPage() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const sendPrompt = async () => {
    if (!prompt.trim()) return;

    // Add user message to the chat
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    const userPrompt = prompt;
    setPrompt("");

    try {
      // POST request to /api/ollama
      const res = await fetch("/api/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt }),
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sendPrompt();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-black p-6">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4 text-blue-600">
          Chat with Deepseek-LLM:7b
        </h1>

        {/* Chat messages */}
        <div className="border border-gray-300 rounded p-4 mb-4 h-64 overflow-auto">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-2 p-2 rounded inline-block max-w-[80%] ${
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
        <div className="flex gap-2">
          <input
            type="text"
            className="border flex-1 rounded px-3 py-2"
            placeholder="Type your prompt here..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={sendPrompt}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
