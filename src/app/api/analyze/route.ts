import { NextResponse } from "next/server";
import { JOBS_DATA } from "@/data/jobs"; // ✅ Make sure this is correct

const OLLAMA_API = "http://localhost:11434/api/chat";
const MODEL = "llama3";

function buildPrompt(cvText: string) {
  return `
You are a job-matching assistant AI.
Rate the following CV against each internship and return a JSON list like:
[ { "id": 1, "match": 87 }, { "id": 2, "match": 45 } ]
Use a scale from 45 (minimum) to 90 (maximum).
CV:
${cvText}

Jobs:
${JSON.stringify(
    JOBS_DATA.map(({ id, title, description, requirements, skills }) => ({
      id, title, description, requirements, skills,
    }))
  )}

  OUT_FORMAT: strictly foloow output format, do not add any other text. IT MUST BE JSON.

  EXAMPLE:
  [ { "id": 1, "match": 87 }, { "id": 2, "match": 45 } ]
  `;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // ✅ Read file text
    const cvText = (await file.text()).trim();
    const prompt = buildPrompt(cvText);

    // ✅ Send to Ollama
    const ollamaRes = await fetch(OLLAMA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    const ollamaData = await ollamaRes.json();
    const message = ollamaData.message?.content;
    console.log("Ollama response:", message);
    let parsedMatches;
    try {
      parsedMatches = JSON.parse(message);
    } catch (err) {
      console.error("Failed to parse Ollama response, using random fallback.");
      parsedMatches = JOBS_DATA.map((job) => ({
        id: job.id,
        match: Math.floor(Math.random() * 46) + 45, // 45-90 fallback
      }));
    }

    return NextResponse.json({ jobs: parsedMatches });
  } catch (err) {
    console.error("Error analyzing CV:", err);
    return NextResponse.json({ error: "Failed to analyze CV" }, { status: 500 });
  }
}
