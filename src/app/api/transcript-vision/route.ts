import { NextResponse } from 'next/server';
import { JOBS_DATA } from '@/shared';

// We assume the local Ollama model `gemma3:4b` supports vision (user claims capability). We send the image as base64.
// The model is instructed to return STRICT JSON we can parse.

export const runtime = 'nodejs';

interface VisionJobRating { jobId: number; score: number; reason: string }
interface VisionResponse { skills: string[]; jobs: VisionJobRating[]; summary: string }

function buildJobContext() {
  return JOBS_DATA.map(j => ({ id: j.id, title: j.title, skills: j.skills.slice(0,6) })).slice(0, 30); // cap for context
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Send multipart/form-data with a single image field named "file".' }, { status: 400 });
    }
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString('base64');

    const jobContext = buildJobContext();
    const systemPrompt = `You are an AI career advisor. You are given an image of a university transcript. Extract relevant courses, subjects, or domains and infer the candidate's technical or analytical skills. Then evaluate EACH job entry provided (array of {id,title,skills}). Return STRICT JSON ONLY matching this TypeScript interface:
interface VisionResponse { skills: string[]; jobs: { jobId: number; score: number; reason: string }[]; summary: string }
Rules:
- score is integer 0-100 (higher means better fit)
- include at most 8 distinct high-level inferred skills
- reason: concise (<160 chars) citing key overlaps or gaps
- summary: brief overall guidance (<120 words)
DO NOT include markdown, backticks, or commentary. JSON only.`;

    const userPrompt = `Evaluate these jobs for the transcript image. Jobs JSON: ${JSON.stringify(jobContext)}.`;

    const ollamaResp = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:4b',
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt, images: [b64] }
        ]
      })
    });
    if (!ollamaResp.body) {
      return NextResponse.json({ error: 'No response body from model' }, { status: 500 });
    }
    const reader = ollamaResp.body.getReader();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.message?.content) full += obj.message.content;
        } catch {
          // ignore non-JSON lines
        }
      }
    }
    // Attempt to extract JSON from full (model may prefix accidental text). We find first '{' and last '}'
    let parsed: VisionResponse | null = null;
    const start = full.indexOf('{');
    const end = full.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const maybe = full.slice(start, end + 1);
      try { parsed = JSON.parse(maybe); } catch {}
    }
    if (!parsed) {
      return NextResponse.json({ error: 'Failed to parse model JSON', raw: full.slice(0, 4000) }, { status: 502 });
    }
    // Basic validation / sanitation
    parsed.skills = Array.isArray(parsed.skills) ? parsed.skills.slice(0,8).map(s=>String(s).slice(0,40)) : [];
    parsed.jobs = Array.isArray(parsed.jobs) ? parsed.jobs.map(j => ({
      jobId: Number(j.jobId),
      score: Math.min(100, Math.max(0, Number(j.score) || 0)),
      reason: String(j.reason || '').slice(0, 200)
    })).filter(j => jobContext.find(jc => jc.id === j.jobId)).slice(0, jobContext.length) : [];
    parsed.summary = String(parsed.summary || '').slice(0, 800);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Vision analysis failed', err);
    return NextResponse.json({ error: 'Vision analysis failed' }, { status: 500 });
  }
}
