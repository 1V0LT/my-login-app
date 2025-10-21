import { NextRequest, NextResponse } from "next/server";

// Optional: keep this route on the Node runtime to allow streaming/proxying
export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(process.env.ELEVENLABS_API_KEY);
  return NextResponse.json({ configured });
}

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = (await req.json().catch(() => ({}))) as {
      text?: string;
      voiceId?: string;
    };
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const defaultVoice = process.env.ELEVENLABS_VOICE_ID; // set this in env
    const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Online TTS not configured. Set ELEVENLABS_API_KEY env var.",
        },
        { status: 400 }
      );
    }

    let chosenVoice = voiceId || defaultVoice;
    if (!chosenVoice) {
      // Try to fetch voices and pick a sensible default (prefer Rachel)
      const voicesResp = await fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET",
        headers: { "xi-api-key": apiKey, Accept: "application/json" },
      });
      if (voicesResp.ok) {
        const data = (await voicesResp.json().catch(() => ({}))) as { voices?: Array<{ voice_id: string; name?: string }> };
        const list = Array.isArray(data.voices) ? data.voices : [];
        const rachel = list.find(v => /rachel/i.test(v.name || ""));
        chosenVoice = (rachel || list[0])?.voice_id;
      }
      if (!chosenVoice) {
        return NextResponse.json(
          {
            error:
              "No ElevenLabs voice available. Set ELEVENLABS_VOICE_ID or ensure your account has at least one voice.",
          },
          { status: 400 }
        );
      }
    }

    // ElevenLabs Streaming TTS endpoint
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      chosenVoice
    )}/stream?optimize_streaming_latency=2`;

    // Note: ElevenLabs does not support a direct numeric speed control; keep voice_settings simple
    const body = {
      text: text.toString(),
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        // style and use_speaker_boost can be adjusted via env in the future
      },
    } as Record<string, unknown>;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `TTS provider error (${resp.status}): ${errText || "unknown"}` },
        { status: 500 }
      );
    }

    // Proxy the audio/mpeg stream back to the client
    return new NextResponse(resp.body as ReadableStream<Uint8Array>, {
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
