import { NextRequest, NextResponse } from "next/server";
import googleTTS from "google-tts-api";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ configured: true, provider: "google-tts" });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { text?: string; lang?: string };
    const text = (body?.text ?? "").toString();
    const lang = typeof body?.lang === "string" ? body.lang : "en";
    if (!text.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    // Build list of audio URLs for the text
    const parts = googleTTS.getAllAudioUrls(text, {
      lang: lang.slice(0, 5),
      slow: false,
      host: "https://translate.google.com",
    });

    // Stream concatenated audio/mpeg back to the client
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const p of parts) {
            const r = await fetch(p.url);
            if (!r.ok || !r.body) continue;
            const reader = r.body.getReader();
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) controller.enqueue(value);
            }
          }
        } catch {
          // ignore errors
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
