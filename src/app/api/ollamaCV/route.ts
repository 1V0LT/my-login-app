import { NextResponse } from "next/server";
import { JOBS_DATA } from "@/data/jobs";

const OLLAMA_API = "http://localhost:11434/api/chat";
const MODEL = "llama3";

function buildPrompt(cvText: string) {
  return `
You are a Internship-matching assistant AI.
Rate the following CV against each internship and return only valid JSON like:
[ { "id": 1, "match": 90 }, { "id": 2, "match": 45 } ]
Use a scoring range from 45 to 90.

CV:
${cvText}

Jobs:
${JSON.stringify(
    JOBS_DATA.map(({ id, title, description, requirements, skills }) => ({
      id, title, description, requirements, skills
    }))
  )}
`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const cvText = (await file.text()).trim();
    const prompt = buildPrompt(cvText);

    // ⏱ Timeout now set to 5 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(OLLAMA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: {
          temperature: 0.2,
          max_tokens: 400
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ollama error:", response.status, errorText);
      return NextResponse.json({ error: "Ollama model error" }, { status: 500 });
    }

    const ollamaResult = await response.json();
    const raw = ollamaResult.message?.content || "";

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn("⚠️ Failed to parse Ollama response. Returning fallback.");

      parsed = JOBS_DATA.map((job) => ({
        id: job.id,
        match: Math.floor(Math.random() * 46 + 45), // 45–90 fallback
      }));
    }

    return NextResponse.json({ jobs: parsed });
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json({ error: "Ollama request timed out" }, { status: 504 });
    }
    console.error("Unhandled error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
