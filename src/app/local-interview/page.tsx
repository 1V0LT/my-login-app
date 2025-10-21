"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JOBS_DATA } from "@/shared";

// Minimal message type
type Role = "system" | "user" | "assistant";
interface Msg { id: string; role: Role; content: string; ts: number }

function uid() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

export default function LocalInterviewPage() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("job") ? Number(params.get("job")) : undefined;
  const job = useMemo(() => JOBS_DATA.find(j => j.id === jobId), [jobId]);

  // Chat state
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera + UI layout toggles
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [showTranscript, setShowTranscript] = useState(false); // transcript is hidden until expanded

  // Simple cues
  const [cues, setCues] = useState({ nodding: false, shaking: false, attentive: true, thumbsUp: false });
  const [gestureAvailable, setGestureAvailable] = useState(false);
  const [detectorAvailable, setDetectorAvailable] = useState(false);
  const [detectorOn, setDetectorOn] = useState(true);
  const detectorOnRef = useRef(detectorOn);
  useEffect(() => { detectorOnRef.current = detectorOn; }, [detectorOn]);

  // Environment flags derived from object detection
  const [env, setEnv] = useState<{ personCount: number; phone: boolean }>({ personCount: 0, phone: false });
  const envRef = useRef(env);
  useEffect(() => { envRef.current = env; }, [env]);
  const lastEnvAlertRef = useRef<number>(0);
  const alertedPhoneRef = useRef(false);
  const alertedPeopleRef = useRef(false);

  // Online/CDN paths (user asked to use online). Allow env override with sane defaults
  const MP_BASE = process.env.NEXT_PUBLIC_MEDIAPIPE_BASE || "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";
  const FACE_MODEL = process.env.NEXT_PUBLIC_MEDIAPIPE_FACE_MODEL || "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  const GESTURE_MODEL = process.env.NEXT_PUBLIC_MEDIAPIPE_GESTURE_MODEL || "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float32/1/gesture_recognizer.task";
  const OD_MODEL = process.env.NEXT_PUBLIC_MEDIAPIPE_OD_MODEL || "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite";

  // TTS
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [rate, setRate] = useState<number>(1);
  const [displayVoices, setDisplayVoices] = useState<Array<{ label: string; voiceURI: string; lang: string; sourceName: string }>>([]);
  const [useOnlineTTS, setUseOnlineTTS] = useState<boolean>(() => {
    // Default to Online TTS ON unless explicitly disabled
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem("tts.online");
      if (saved === "1") return true;
      if (saved === "0") return false;
    } catch {}
    const envDefault = process.env.NEXT_PUBLIC_TTS_ONLINE;
    if (envDefault === "0") return false;
    // default ON
    return true;
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // STT (browser-provided if available)
  const recRef = useRef<SpeechRecognition | null>(null);
  const [sttOn, setSttOn] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(false);

  // Keep latest sender without re-wiring STT
  const sendRef = useRef<(text: string) => void>(() => {});
  const silentSendRef = useRef<(text: string) => void>(() => {});

  // Init TTS and STT
  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis ?? null;
      // audio element for online TTS playback
      if (!audioRef.current) audioRef.current = new Audio();
      // Restore TTS prefs
      try {
        const savedUri = localStorage.getItem("tts.voiceURI");
        const savedRate = localStorage.getItem("tts.rate");
        const savedOnline = localStorage.getItem("tts.online");
        if (savedUri) setVoiceURI(savedUri);
        if (savedRate) setRate(Number(savedRate) || 1);
        if (savedOnline === "1") setUseOnlineTTS(true);
        else if (savedOnline === "0") setUseOnlineTTS(false);
        else if (process.env.NEXT_PUBLIC_TTS_ONLINE === "0") setUseOnlineTTS(false);
        else if (process.env.NEXT_PUBLIC_TTS_ONLINE === "1") setUseOnlineTTS(true);
      } catch {}

      // Populate voices; on some browsers it is async via voiceschanged
      const updateVoices = () => {
        const all = synthRef.current?.getVoices() ?? [];
        setVoices(all);
        const en = all.filter(x => /en/i.test(x.lang));
        const picks: Array<{ label: string; voiceURI: string; lang: string; sourceName: string }> = [];
        const addPick = (regex: RegExp, label: string) => {
          const v = en.find(x => regex.test(x.name));
          if (v && !picks.some(p => p.voiceURI === v.voiceURI)) {
            picks.push({ label, voiceURI: v.voiceURI, lang: v.lang, sourceName: v.name });
          }
        };
        // Curated categories in priority order
        addPick(/Siri/i, "Siri");
        addPick(/Natural/i, "Natural");
        addPick(/Neural/i, "Neural");
        addPick(/Google/i, "Google");
        // If we don't have enough curated entries, fill with top English voices
        if (picks.length < 4 && en.length) {
          const already = new Set(picks.map(p => p.voiceURI));
          const score = (name: string) => {
            let s = 0;
            if (/Siri|Premium|Enhanced|Neural|Natural|Google/i.test(name)) s += 3;
            if (/Samantha|Alex|Daniel|Karen|Moira|Victoria|Tessa|Rishi|Kathy|Fred/i.test(name)) s += 2;
            return s;
          };
          const sorted = [...en].sort((a, b) => score(b.name) - score(a.name));
          for (const v of sorted) {
            if (already.has(v.voiceURI)) continue;
            picks.push({ label: `English – ${v.name}`, voiceURI: v.voiceURI, lang: v.lang, sourceName: v.name });
            if (picks.length >= 4) break;
          }
        }
        if (picks.length === 0 && en[0]) {
          picks.push({ label: "English (Default)", voiceURI: en[0].voiceURI, lang: en[0].lang, sourceName: en[0].name });
        }
        setDisplayVoices(picks);
        if ((!voiceURI || !picks.some(p => p.voiceURI === voiceURI)) && picks[0]) {
          setVoiceURI(picks[0].voiceURI);
        }
      };
      updateVoices();
      if (typeof window !== "undefined") {
        window.speechSynthesis?.addEventListener?.("voiceschanged", updateVoices);
        // Fallback in case event doesn't fire
        setTimeout(updateVoices, 400);
      }
      type SRWindow = Window & typeof globalThis & {
        webkitSpeechRecognition?: { new (): SpeechRecognition };
        SpeechRecognition?: { new (): SpeechRecognition };
      };
      const w = window as unknown as SRWindow;
      const SR = w.webkitSpeechRecognition || w.SpeechRecognition;
      if (SR) {
        const rec: SpeechRecognition = new SR();
        rec.continuous = false; rec.interimResults = false; rec.lang = "en-US";
        rec.onresult = (e: SpeechRecognitionEvent) => {
          const text = (e.results?.[0]?.[0]?.transcript ?? "").toString();
          if (text.trim()) {
            pushUser(text.trim());
            sendRef.current(text.trim());
          }
        };
        rec.onerror = () => setSttOn(false);
        rec.onend = () => setSttOn(false);
        recRef.current = rec; setSttAvailable(true);
      }
    }
  }, [voiceURI]);

  // Persist TTS prefs
  useEffect(() => {
    try {
      if (voiceURI) localStorage.setItem("tts.voiceURI", voiceURI);
      localStorage.setItem("tts.rate", String(rate));
      localStorage.setItem("tts.online", useOnlineTTS ? "1" : "0");
    } catch {}
  }, [voiceURI, rate, useOnlineTTS]);

  // Initialize camera + try MediaPipe face landmarker if assets are present
  const initVision = useCallback(async () => {
    try {
      const v = videoRef.current; const c = canvasRef.current; if (!v || !c) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      v.srcObject = stream; await v.play();
      const ctx = c.getContext("2d");

      // Try to load mediapipe; if assets missing, continue without cues
      let landmarker: import("@mediapipe/tasks-vision").FaceLandmarker | null = null;
      let gestureRecognizer: import("@mediapipe/tasks-vision").GestureRecognizer | null = null;
      let objectDetector: import("@mediapipe/tasks-vision").ObjectDetector | null = null;
        try {
          const vision = await import("@mediapipe/tasks-vision");
          const { FaceLandmarker, FilesetResolver, GestureRecognizer, ObjectDetector } = vision as typeof import("@mediapipe/tasks-vision");
          const files = await FilesetResolver.forVisionTasks(MP_BASE);
          landmarker = await FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: false,
        });
        if (GestureRecognizer) {
          try {
            gestureRecognizer = await GestureRecognizer.createFromOptions(files, {
              baseOptions: { modelAssetPath: GESTURE_MODEL, delegate: "GPU" },
              runningMode: "VIDEO",
              numHands: 1,
            });
            setGestureAvailable(true);
          } catch {
            // gesture recognizer not available or assets missing
            setGestureAvailable(false);
          }
        }
        try {
          objectDetector = await ObjectDetector.createFromOptions(files, {
            baseOptions: { modelAssetPath: OD_MODEL, delegate: "GPU" },
            runningMode: "VIDEO",
            scoreThreshold: 0.3,
          } as unknown as Record<string, unknown>);
          setDetectorAvailable(true);
        } catch {
          setDetectorAvailable(false);
        }
      } catch { console.warn("MediaPipe not loaded; running without cues."); }

      const prev: { x?: number; y?: number; t?: number } = {};
      const loop = () => {
        if (!v || !ctx) { rafRef.current = requestAnimationFrame(loop); return; }
        c.width = v.videoWidth; c.height = v.videoHeight;
  // Clear overlay (we rely on the underlying <video> for the live image)
  ctx.clearRect(0, 0, c.width, c.height);
  // For shapes/landmarks, mirror drawing to align with mirrored video
  ctx.save();
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  let newNodding = false; let newShaking = false; let newThumbs = false;
        if (gestureRecognizer) {
          const gres = gestureRecognizer.recognizeForVideo(v, performance.now());
          // Result can be one of two shapes depending on version:
          // 1) gestures: Array<{ categories: Array<{categoryName, score}> }>
          // 2) gestures: Array<Array<{categoryName, score}>>
          type Cat = { categoryName?: string; score?: number };
          type GestureItem = Cat[] | { categories?: Cat[] };
          const gestures = (gres?.gestures as GestureItem[] | undefined) ?? undefined;
          let topName: string | undefined; let topScore = 0;
          if (Array.isArray(gestures) && gestures.length > 0) {
            const first = gestures[0];
            if (Array.isArray(first)) {
              const c: Cat | undefined = first[0];
              if (c && typeof c.categoryName === 'string') {
                topName = c.categoryName.toLowerCase();
                topScore = typeof c.score === 'number' ? c.score : 0;
              }
            } else if (first && typeof first === 'object') {
              const c: Cat | undefined = Array.isArray(first.categories) ? first.categories[0] : undefined;
              if (c && typeof c.categoryName === 'string') {
                topName = c.categoryName.toLowerCase();
                topScore = typeof c.score === 'number' ? c.score : 0;
              }
            }
          }
          if (topName) {
            const isThumbUp = topName.includes('thumb_up') || (topName.includes('thumb') && topName.includes('up')) || topName.includes('thumbs_up');
            if (isThumbUp && topScore >= 0.3) newThumbs = true; // lowered threshold to improve detection feel
          }
        }
        // Object detection: draw blue box/label for person and cell phone (Studio style)
        if (detectorOnRef.current && objectDetector) {
          const dres = objectDetector.detectForVideo(v, performance.now());
          const dets = dres?.detections || [];
          let personCount = 0;
          let phoneDetected = false;
          for (const d of dets) {
            const cat = d.categories?.[0];
            const name = (cat?.categoryName || "").toLowerCase();
            if (name === "person" || name === "cell phone" || name === "mobile phone" || (name.includes("phone") && !name.includes("headphone"))) {
              const bb = d.boundingBox;
              if (bb) {
                // Mirror drawing context already applied
                ctx.strokeStyle = "#3B82F6"; // blue-500
                ctx.lineWidth = 3;
                ctx.strokeRect(bb.originX, bb.originY, bb.width, bb.height);
                // Label background
                const label = `${name} ${Math.round((cat?.score || 0) * 100)}%`;
                ctx.font = "16px ui-sans-serif, system-ui, -apple-system";
                const padX = 8;
                const textWidth = ctx.measureText(label).width;
                const lx = Math.max(0, Math.min(bb.originX, c.width - (textWidth + padX * 2)));
                const ly = Math.max(0, bb.originY - 24);
                ctx.fillStyle = "#3B82F6";
                const labelWidth = textWidth + padX * 2;
                ctx.fillRect(lx, ly, labelWidth, 22);
                // Draw label text in screen (unmirrored) space so it reads correctly
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to identity
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "16px ui-sans-serif, system-ui, -apple-system";
                const textX = c.width - (lx + labelWidth) + padX; // convert mirrored x to normal x
                const textY = ly + 16;
                ctx.fillText(label, textX, textY);
                ctx.restore();
              }
            }
            if (name === "person") personCount += 1;
            if (name === "cell phone" || name === "mobile phone" || (name.includes("phone") && !name.includes("headphone"))) phoneDetected = true;
          }
          // Update environment state (avoid excessive re-renders)
          const prevEnv = envRef.current;
          if (prevEnv.personCount !== personCount || prevEnv.phone !== phoneDetected) {
            setEnv({ personCount, phone: phoneDetected });
          }
        }
        if (landmarker) {
          const res = landmarker.detectForVideo(v, performance.now());
          const lm = res?.faceLandmarks?.[0];
          if (lm && lm.length) {
            const nose = lm[1]; const now = performance.now();
            if (prev.y !== undefined && prev.t !== undefined) {
              const dy = Math.abs(nose.y - (prev.y as number));
              const dx = Math.abs(nose.x - (prev.x as number));
              const dt = (now - (prev.t as number)) / 1000;
              newNodding = dy / (dt || 0.016) > 0.5;
              newShaking = dx / (dt || 0.016) > 0.5;
            }
            prev.x = nose.x; prev.y = nose.y; prev.t = now;

            // Skip drawing face landmarks (remove blue dotted outline)

            // Removed green face outline as requested (keep landmarks only)
          }
        } else {
          // Draw simple center guides when MediaPipe is not available
          const cx = c.width / 2; const cy = c.height / 2;
          ctx.strokeStyle = "rgba(148,163,184,0.8)"; // slate-400
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy);
          ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20);
          ctx.stroke();
          }
        // Commit cues state from this frame (no HUD text on top)
        setCues({ nodding: newNodding, shaking: newShaking, attentive: true, thumbsUp: newThumbs });
        // Restore after drawing mirrored overlays and text
        ctx.restore();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      console.warn("Camera init failed", e);
    }
  }, [MP_BASE, FACE_MODEL, GESTURE_MODEL, OD_MODEL]);

  // Alert AI automatically if phone or multiple people detected (with cooldown)
  useEffect(() => {
    const now = Date.now();
    const cooldownMs = 20000; // 20s cooldown between alerts
    if (!detectorOn) return;
    const hasPhone = env.phone;
    const extraPeople = env.personCount > 1;
    const readyForAlert = now - lastEnvAlertRef.current > cooldownMs;
    let message: string | null = null;
    if (hasPhone && !alertedPhoneRef.current) {
      message = "Observation: A cell phone is visible in the interview. Politely remind the candidate that using a phone during the interview is not allowed and ask them to put it away.";
      alertedPhoneRef.current = true;
    }
    if (extraPeople && !alertedPeopleRef.current) {
      message = message
        ? message + " Also, more than one person appears to be present; ask the candidate to continue the interview alone."
        : "Observation: More than one person appears in the frame. Politely remind the candidate that only the applicant should be present during the interview.";
      alertedPeopleRef.current = true;
    }
    if ((hasPhone || extraPeople) && readyForAlert && message) {
      lastEnvAlertRef.current = now;
  const fn = silentSendRef.current;
      if (fn) fn(message);
    }
    if (!hasPhone) alertedPhoneRef.current = false; // reset so we can alert again later if it reappears (after cooldown)
    if (!extraPeople) alertedPeopleRef.current = false;
  }, [detectorOn, env.personCount, env.phone]);

  useEffect(() => {
    const vid = videoRef.current;
    void initVision();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const stream = (vid?.srcObject as MediaStream | null) || null;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [initVision]);

  const speak = useCallback(async (text: string) => {
    const trimmed = text?.toString() ?? "";
    if (!trimmed) return;

    const playBrowserTTS = () => {
      const synth = synthRef.current; if (!synth) return false;
      try {
        if (synth.speaking) synth.cancel();
        const u = new SpeechSynthesisUtterance(trimmed);
        const v = voices.find(vv => vv.voiceURI === voiceURI) || null;
        if (v) u.voice = v;
        u.rate = Math.min(2, Math.max(0.5, rate || 1));
        u.pitch = 1;
        u.onend = () => setSpeaking(false);
        setSpeaking(true);
        synth.speak(u);
        return true;
      } catch {
        return false;
      }
    };

    if (useOnlineTTS) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          if (!audioRef.current) audioRef.current = new Audio();
          audioRef.current.src = url;
          setSpeaking(true);
          await audioRef.current.play().catch(() => {});
          audioRef.current.onended = () => {
            setSpeaking(false);
            URL.revokeObjectURL(url);
          };
          return;
        }
      } catch {
        // fall back to browser TTS
      }
    }
    // Fallback
    playBrowserTTS();
  }, [rate, useOnlineTTS, voiceURI, voices]);

  const pushUser = (text: string) => setMessages(m => [...m, { id: uid(), role: "user", content: text, ts: Date.now() }]);

  const sendToModel = useCallback(async (userText: string, syntheticUser = false) => {
    if (!userText.trim() || busy) return; setError(null);
    let hist = messages;
    if (!syntheticUser) { const m = { id: uid(), role: "user" as Role, content: userText.trim(), ts: Date.now() }; hist = [...messages, m]; setMessages(hist); }

  const cueLine = `[[nonverbal cues: nodding=${cues.nodding ? "yes" : "no"}, shaking=${cues.shaking ? "yes" : "no"}, thumbsUp=${cues.thumbsUp ? "yes" : "no"}, attentive=${cues.attentive ? "yes" : "no"}]] [[environment: phone=${env.phone ? "yes" : "no"}, personCount=${env.personCount}]]`;
    const conv = hist.filter(m => m.role !== "system").map(m => (m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`)).concat(`User: ${userText.trim()}\n${cueLine}`).join("\n\n");

    try {
      setBusy(true);
      const res = await fetch("/api/ollama", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ prompt: conv }) });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.error || "Model error"); }
      const data = await res.json() as { response?: string };
      const text = (data.response ?? "No response").trim();
      setMessages(m => [...m, { id: uid(), role: "assistant", content: text, ts: Date.now() }]);
      speak(text);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message) : 'Something went wrong.';
      setError(msg);
      setMessages(m => [...m, { id: uid(), role: "assistant", content: `Error: ${msg}`, ts: Date.now() }]);
    } finally { setBusy(false); }
  }, [busy, cues.attentive, cues.nodding, cues.shaking, cues.thumbsUp, env.personCount, env.phone, messages, speak]);

  // Reset with job context and kick off intro
  useEffect(() => {
    (async () => {
      if (messages.length > 0) return;
      try {
        await fetch("/api/ollama", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ reset: true, jobId }) });
        const intro = job ? `Conduct an interview for ${job.title} at ${job.company}. Begin.` : "Begin the interview.";
        await sendToModel(intro, true);
      } catch { await sendToModel("Begin the interview.", true); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // keep latest sender in ref
  useEffect(() => {
    sendRef.current = (t: string) => { void sendToModel(t); };
    silentSendRef.current = (t: string) => { void sendToModel(t, true); };
  }, [sendToModel]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div className="mx-auto max-w-screen-2xl px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Local Interview</h1>
            <p className="mt-1 text-sm text-slate-600">Model: llama3.2 (local) • {job ? `Job: ${job.title}` : "No job selected"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>router.push("/dashboard")} className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Back</button>
          </div>
        </div>

        {job && (
          <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Context: {job.title} • {job.company} • Skills: {job.skills.slice(0,5).join(", ")}
          </div>
        )}

        <div className="mt-6 grid grid-cols-12 gap-6 min-h-[76vh] items-start">
          {/* Camera panel */}
          <div className={showTranscript ? "col-span-12 lg:col-span-5" : "col-span-12"}>
            <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-slate-700">Camera</div>
                  <span className={`hidden sm:inline rounded-full px-2 py-1 text-[10px] font-medium shadow ${gestureAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>Gesture: {gestureAvailable ? 'On' : 'Off'}</span>
                  <span className={`hidden sm:inline rounded-full px-2 py-1 text-[10px] font-medium shadow ${detectorAvailable ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>Detector: {detectorAvailable ? (detectorOn ? 'On' : 'Off') : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {detectorAvailable && (
                    <button onClick={()=>setDetectorOn(v=>!v)} className="text-xs rounded-md border px-2 py-1 bg-white hover:bg-slate-50">
                      {detectorOn ? 'Disable Detection' : 'Enable Detection'}
                    </button>
                  )}
                  {/* Online TTS toggle */}
                  <label className="hidden md:flex items-center gap-1 text-xs text-slate-600" title="Use online TTS (if configured)">
                    <input
                      type="checkbox"
                      checked={useOnlineTTS}
                      onChange={(e)=>setUseOnlineTTS(e.target.checked)}
                    />
                    <span>Online TTS</span>
                  </label>
                  {/* TTS voice selector (to reduce robotic sound) */}
                  <select
                    value={voiceURI ?? ''}
                    onChange={(e)=>setVoiceURI(e.target.value || null)}
                    className="hidden md:block text-xs rounded-md border px-2 py-1 bg-white"
                    title="Choose TTS Voice"
                  >
                    {displayVoices.length === 0 ? <option value="">Default voice</option> : null}
                    {displayVoices.map(v => (
                      <option key={v.voiceURI} value={v.voiceURI}>{v.label}</option>
                    ))}
                  </select>
                  <label className="hidden md:flex items-center gap-1 text-xs text-slate-600" title="TTS Rate">
                    <span>Rate</span>
                    <input type="range" min={0.6} max={1.4} step={0.05}
                      value={rate}
                      onChange={(e)=>setRate(Number(e.target.value))}
                    />
                  </label>
                  <button onClick={()=>setShowTranscript(v=>!v)} className="text-xs rounded-md border px-2 py-1 bg-white hover:bg-slate-50">
                    {showTranscript ? "Expand Camera" : "Show Transcript"}
                  </button>
                </div>
              </div>
                  <div className={`relative ${showTranscript ? "aspect-[4/3]" : "aspect-video"} w-full overflow-hidden rounded-lg bg-black mt-2 ring-1 ring-black/5`}>
                {/* Mirror the video so it behaves like a front-facing camera */}
                <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover -scale-x-100" muted playsInline />
                {/* Keep canvas unmirrored; we mirror the drawing context for shapes but draw text normally */}
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
                {/* Removed thumbs up badge per request */}
              </div>
              <div className="mt-2 text-[11px] text-slate-600">Cues: nodding={cues.nodding?"yes":"no"} • shaking={cues.shaking?"yes":"no"} • attentive={cues.attentive?"yes":"no"}</div>
              <div className="mt-1 text-[11px] text-slate-500">Tip: Place MediaPipe assets under /public/mediapipe to run fully offline.</div>
            </div>
          </div>

          {/* Conversation / Transcript panel */}
          <div className={showTranscript ? "col-span-12 lg:col-span-7" : "hidden"}>
            <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-3 shadow-sm h-full min-h-[50vh] flex flex-col">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-700">Transcript</div>
                <div className="text-[11px] text-slate-500">{busy ? "AI is responding…" : "Ready"}</div>
              </div>
              <div className="mt-2 flex-1 overflow-y-auto rounded-md border p-2 bg-white/80">
                {messages.length === 0 ? (
                  <div className="h-full grid place-items-center text-slate-500 text-sm">Starting interview…</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {messages.map(m => (
                      <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900"}`}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {error && <div className="text-xs text-rose-600">Error: {error}</div>}
                  </div>
                )}
              </div>
              {/* Composer */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{ if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const t=input.trim(); if(t){ pushUser(t); setInput(""); void sendToModel(t); } } }}
                  placeholder="Type your answer…"
                  className="flex-1 rounded-md border px-3 py-2 text-sm"
                />
                <button
                  onClick={()=>{ const t=input.trim(); if(!t) return; pushUser(t); setInput(""); void sendToModel(t); }}
                  disabled={busy}
                  className="rounded-md bg-blue-600 text-white px-3 py-2 text-sm disabled:opacity-50"
                >Send</button>
                <button
                  onClick={()=>{ const rec = recRef.current; if(!rec) return; if (speaking && synthRef.current) synthRef.current.cancel(); try { setSttOn(true); rec.start(); } catch { setSttOn(false); } }}
                  disabled={!sttAvailable || sttOn || busy}
                  className="rounded-md border px-3 py-2 text-sm bg-white disabled:opacity-50"
                  title={sttAvailable ? "Speak your answer" : "Browser STT not available"}
                >{sttOn?"Listening…":"🎙️ Speak"}</button>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">TTS: On-device speechSynthesis • STT: Browser STT (may not be fully offline)</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
