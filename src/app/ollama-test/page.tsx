"use client";

import { useState } from "react";

export default function OllamaTestPage() {
  const [response, setResponse] = useState("");

  const handleTestOllama = async () => {
    try {
      // Just a simple GET fetch to /api/ollama
      const res = await fetch("/api/ollama");
      const data = await res.json();
      setResponse(data.response || JSON.stringify(data));
    } catch (err) {
      console.error("Error calling /api/ollama:", err);
      setResponse("Error calling /api/ollama");
    }
  };

  return (
    <div className="p-4">
      <h1>Ollama Test Page</h1>
      <button onClick={handleTestOllama}>
        Test Ollama (GET)
      </button>
      <pre>{response}</pre>
    </div>
  );
}
