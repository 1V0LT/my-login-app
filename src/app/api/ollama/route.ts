import { NextResponse } from "next/server";

type Role = "system" | "user" | "assistant";
type ChatMessage = { role: Role; content: string };

const initialSystem: ChatMessage = {
  role: "system",
  content:
    "You are the employer, conducting a job interview for a software engineering position. " +
    "chose a random name and a random company name to make the interview more realistic. " +
    "The candidate is trying to get the job. Make the interview realistic: introduce yourself first, " +
    "then allow the candidate to introduce themselves, ask up to 3 questions, and at the end, " +
    "give them a skill rating out of 10 (e.g., 7.8/10). If they make mistakes, point them out constructively." +
    "Dont be too nice since this is a job interview. make the interview as realistic as possible." +
    "any thing i tell you thats between this ** take it as an absolute comand. ",
};

// Chat history, including an initial system message (AI role-play setup)
let chatHistory: ChatMessage[] = [initialSystem];

export async function POST(req: Request) {
  console.log("=== [OLLAMA API] Incoming POST request ===");

  try {
    const body = (await req.json()) as { prompt?: string; reset?: boolean };
    const { prompt, reset } = body ?? {};
    console.log("Received prompt:", prompt, "reset:", reset);

    if (reset) {
      chatHistory = [initialSystem];
      return NextResponse.json({ ok: true });
    }

    if (!prompt) {
      console.log("No prompt provided");
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    // Append user input to chat history
    chatHistory.push({ role: "user", content: prompt });

    // Format conversation properly
    const formattedHistory = chatHistory.map((entry) => ({
      role: entry.role, // "system", "user", or "assistant"
      content: entry.content,
    }));

    console.log("Formatted chat history:", formattedHistory);

    // Call Ollama API with full conversation history
    const ollamaResponse = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2", // Change model if needed
        messages: formattedHistory, // Send conversation history
        stream: true, // Enable streaming
      }),
    });

    if (!ollamaResponse.body) {
      console.error("Ollama API response has no body!");
      return NextResponse.json({ error: "Ollama API response is empty" }, { status: 500 });
    }

    // Read response stream properly
    const reader = ollamaResponse.body.getReader();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      console.log("Received chunk:", chunk);

      // Process streamed JSON chunks
      const jsonObjects = chunk.split("\n").filter(line => line.trim() !== "");

      for (const jsonObject of jsonObjects) {
        try {
          const parsed = JSON.parse(jsonObject);
          if (parsed.message?.content) {
            fullResponse += parsed.message.content;
          }
        } catch (error) {
          console.error("Failed to parse chunk as JSON:", jsonObject, error);
        }
      }
    }

    console.log("Final processed response:", fullResponse);

    // Store AI response in chat history
    chatHistory.push({ role: "assistant", content: fullResponse });

    return NextResponse.json({ response: fullResponse.trim() });

  } catch (error: unknown) {
    console.error("Error in Ollama API request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
