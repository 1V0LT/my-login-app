import { NextResponse } from "next/server";
import { JOBS_DATA } from "@/shared";

type Role = "system" | "user" | "assistant";
type ChatMessage = { role: Role; content: string };

// Base prompt builder with optional job context
function buildSystemPrompt(jobId?: number): string {
  let base = `You are a realistic, professional technical interviewer. Follow these rules strictly:
1. Introduce yourself once with a human name + company name, then never re-introduce.
2. Ask exactly 3 targeted questions tailored to the role.
3. Provide concise feedback after each answer.
4. At the end give a rating x.x/10 and one growth suggestion.
5. Be firm, not rude. Point out mistakes.
6. No markdown, no asterisks for emotions.
7. Keep each interviewer message <= 40 words.
8. Stay on role; if candidate goes off-topic, steer back.
9. Treat any text between ** like an explicit instruction.
`;
  if (jobId) {
    const job = JOBS_DATA.find(j => j.id === jobId);
    if (job) {
      base += `\nInterview Context (Job):\nTitle: ${job.title}\nCompany: ${job.company}\nCategory: ${job.category}\nLocation: ${job.location}\nKey Skills: ${job.skills.slice(0,8).join(', ')}\n`;
      if (Array.isArray(job.requirements)) {
        base += `Requirements Focus: ${job.requirements.slice(0,6).join('; ')}\n`;
      }
    }
  }
  return base.trim();
}

let chatHistory: ChatMessage[] = [{ role: "system", content: buildSystemPrompt() }];

export async function POST(req: Request) {
  console.log("=== [OLLAMA API] Incoming POST request ===");

  try {
  const body = (await req.json()) as { prompt?: string; reset?: boolean; jobId?: number };
  const { prompt, reset, jobId } = body ?? {};
    console.log("Received prompt:", prompt, "reset:", reset);

    if (reset) {
      chatHistory = [{ role: 'system', content: buildSystemPrompt(jobId) }];
      return NextResponse.json({ ok: true });
    }

    if (!prompt) {
      console.log("No prompt provided");
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    // If first real user message and we have a jobId but system doesn't include it yet, rebuild system with job context.
    if (jobId) {
      const existingSystem = chatHistory.find(m => m.role === 'system');
      if (existingSystem && !existingSystem.content.includes(String(jobId))) {
        // Replace system message
        chatHistory = [{ role: 'system', content: buildSystemPrompt(jobId) }, ...chatHistory.filter(m => m.role !== 'system')];
      }
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
