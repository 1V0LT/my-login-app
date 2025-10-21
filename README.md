This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Local Interview (Camera + On-device cues)

- New page at `/local-interview`. If you open it from a job (e.g., Apply buttons), it can include job context via the `?job=<id>` query.
- Uses the browser camera and draws a simple overlay. If MediaPipe assets are present, it detects light head movement to derive nonverbal cues (nodding/shaking) and feeds those cues into the interviewer prompt.
- Assistant voice uses on-device SpeechSynthesis (TTS). Voice input uses the browser's SpeechRecognition if available.

Offline note for MediaPipe:

1. Download MediaPipe Tasks files for Face Landmarker (e.g., `face_landmarker.task` and required wasm assets) from the official MediaPipe repository.
2. Create a folder `public/mediapipe` and place the files there. Example paths:
	- `public/mediapipe/face_landmarker.task`
	- `public/mediapipe/wasm/`
3. The app will attempt to load from `/mediapipe`. If files are missing, it will still run without cues.

Tip: This page calls your existing `/api/ollama` route. Ensure your local model endpoint at `http://localhost:11434` is running and the desired model (e.g., `llama3.2`) is available.

### Optional: Online TTS (cloud)

You can enable a cloud TTS provider (ElevenLabs) as an alternative to the browser's SpeechSynthesis voices. This often sounds more natural.

1. Create an ElevenLabs API key and pick a voice ID
2. Add the following to `.env.local` (or your environment):

```
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_VOICE_ID=your_voice_id_here
# Optional: default the UI to use online TTS
# NEXT_PUBLIC_TTS_ONLINE=1
# Optional model id
# ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

When configured, toggle "Online TTS" in the `/local-interview` toolbar. If the API is unavailable, the app falls back to on-device TTS automatically.
