import { NextResponse } from "next/server";

// Chat history, including an initial system message (AI role-play setup)
let chatHistory: { role: "system" | "user" | "assistant"; content: string }[] = [
  {
    role: "system",
    content: `You are an AI interviewer for a Software Development position.
You must introduce yourself with a random name and mention a random tech company name ONLY ONCE at the very start.

Guidelines:
  1. Start with a single introduction, then proceed as if you're conducting a real interview.
  2. Ask exactly 3 software-development-related questions, one at a time.
  3. Assess the candidate's answers, offering short feedback.
  4. At the end only, give the candidate a rating out of 10 with final remarks.
  5. Stay polite, professional, and consistent.
  6. Do not allow mistakes to go unnoticed.
  7. Do not add notes or comments outside the interview context.
  8. When I tell you my name, greet me with it, then ask questions.
  9. Do not put your emotions in ** or any text inside parentheses () since you have to act like a real human.
  10. Do not allow the candidate to use slang or informal language.
  11. Keep responses concise (30-60 words).

Begin the interview by introducing yourself now.`
  }
];

export async function POST(req: Request) {
  console.log("=== [OLLAMA API] Incoming POST request ===");

  try {
    const { prompt, isSystem } = await req.json() as { prompt?: string, isSystem?: boolean };
    
    if (!prompt) {
      console.log("No prompt provided");
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    // Determine if this is a system prompt (for initialization) or user prompt
    const isSystemPrompt = isSystem || prompt.includes("You are an AI interviewer");
    
    // Append input to chat history with appropriate role
    if (isSystemPrompt) {
      // For system prompts, we keep them separate to maintain clean history
      chatHistory.push({ role: "system", content: prompt });
    } else {
      chatHistory.push({ role: "user", content: prompt });
    }

    // Format conversation properly
    const formattedHistory = chatHistory.map(entry => ({
      role: entry.role, // "system", "user", or "assistant"
      content: entry.content,
    }));

    // Set timeout for the Ollama API request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

    try {
      // Call Ollama API with full conversation history
      const ollamaResponse = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2", // Change model if needed
          messages: formattedHistory, // Send conversation history
          stream: true, // Enable streaming
          options: {
            temperature: 0.75, // Good balance between creativity and consistency
            top_p: 0.9,
            max_tokens: 300, // Keep responses concise
          }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId); // Clear the timeout if the request completes

      if (!ollamaResponse.ok) {
        const errorText = await ollamaResponse.text();
        console.error("Ollama API error:", ollamaResponse.status, errorText);
        return NextResponse.json({ 
          error: `Ollama API error: ${ollamaResponse.status}` 
        }, { status: 500 });
      }

      if (!ollamaResponse.body) {
        console.error("Ollama API response has no body!");
        return NextResponse.json({ error: "Ollama API response is empty" }, { status: 500 });
      }

      // Process the streaming response
      const reader = ollamaResponse.body.getReader();
      let fullResponse = "";
      let buffer = ""; // Buffer for incomplete JSON chunks

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;
        
        // Process complete JSON objects
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep the last possibly incomplete line

        for (const line of lines) {
          if (line.trim() === "") continue;
          
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              fullResponse += parsed.message.content;
            }
          } catch (error) {
            console.warn("Failed to parse chunk as JSON:", line);
          }
        }
      }

      // Process any remaining buffer content
      if (buffer.trim() !== "") {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.message?.content) {
            fullResponse += parsed.message.content;
          }
        } catch (error) {
          console.warn("Failed to parse final buffer as JSON:", buffer);
        }
      }

      // Store AI response in chat history
      chatHistory.push({ role: "assistant", content: fullResponse.trim() });

      return NextResponse.json({ response: fullResponse.trim() });

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error("Request timed out");
        return NextResponse.json({ error: "Request timed out" }, { status: 504 });
      }
      
      throw error; // Re-throw for outer catch block
    }

  } catch (error: any) {
    console.error("Error in Ollama API request:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}

// Helper function to reset the chat history (can be exported for use in other routes)
export async function resetChat(req: Request) {
  chatHistory = [
    {
      role: "system",
      content: `You are an AI interviewer for a Software Development position.
You must introduce yourself with a random name and mention a random tech company name ONLY ONCE at the very start.

Guidelines:
1. Start with a single introduction, then proceed as if you're conducting a real interview.
2. Ask exactly 3 software-development-related questions, one at a time.
3. Assess the candidate's answers, offering short feedback.
4. At the end only, give the candidate a rating out of 10 with final remarks.
5. Stay polite, professional, and consistent.
6. Do not allow mistakes to go unnoticed.
7. Do not add notes or comments outside the interview context.
8. When I tell you my name, greet me with it, then ask questions.
9. Do not put your emotions in ** or any text inside parentheses () since you have to act like a real human.
10. Do not allow the candidate to use slang or informal language.
11. Keep responses concise (30-60 words).

Begin the interview by introducing yourself now.`
    }
  ];
  
  return NextResponse.json({ success: true });
}