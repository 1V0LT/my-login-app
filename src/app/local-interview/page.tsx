"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera + UI layout toggles
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [showTranscript, setShowTranscript] = useState(false); // transcript is hidden until expanded

  // Simple cues
  const [cues, setCues] = useState({ nodding: false, shaking: false, attentive: true, thumbsUp: false });
  // Removed gesture UI; keep flag only if needed for future re-introduction (commented out)
  // const [gestureAvailable, setGestureAvailable] = useState(false);
  const [detectorAvailable, setDetectorAvailable] = useState(false);
  const [detectorOn, setDetectorOn] = useState(true);
  const detectorOnRef = useRef(detectorOn);
  useEffect(() => { detectorOnRef.current = detectorOn; }, [detectorOn]);
  // Toggle for drawing detection overlays (keep detection running regardless). Default: hide overlays.
  const [hideDetections, setHideDetections] = useState(true);

  // Environment flags derived from object detection
  const [env, setEnv] = useState<{ personCount: number; phone: boolean }>({ personCount: 0, phone: false });
  const envRef = useRef(env);
  useEffect(() => { envRef.current = env; }, [env]);
  const lastEnvAlertRef = useRef<number>(0);
  const alertedPhoneRef = useRef(false);
  const alertedPeopleRef = useRef(false);
  // Track sustained detection start times (for 2s dwell requirement)
  const phoneDetectStartRef = useRef<number | null>(null);
  const peopleDetectStartRef = useRef<number | null>(null);

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
  // Removed voice selection UI; keeping placeholder state commented for potential future use
  // const [displayVoices, setDisplayVoices] = useState<Array<{ label: string; voiceURI: string; lang: string; sourceName: string }>>([]);
  const [useOnlineTTS, setUseOnlineTTS] = useState<boolean>(() => {
    // Default to Online TTS ON; allow explicit env override to take precedence
    if (typeof window === "undefined") return true;
    const envDefault = process.env.NEXT_PUBLIC_TTS_ONLINE;
    if (envDefault === "1") return true;
    if (envDefault === "0") return false;
    try {
      const saved = localStorage.getItem("tts.online");
      if (saved === "1") return true;
      if (saved === "0") return false;
    } catch {}
    // default ON
    return true;
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // STT (browser-provided if available)
  const recRef = useRef<SpeechRecognition | null>(null);
  const [sttOn, setSttOn] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(false);
  const [autoSttEnabled] = useState(true); // always-on transcription requested
  const [muted, setMuted] = useState(false); // user mute toggle
  // Prevents auto-restart during intended pauses (set when TTS is about to play)
  const sttSuspendedRef = useRef(false);

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
        // Environment override takes precedence if explicitly set
        if (process.env.NEXT_PUBLIC_TTS_ONLINE === "1") setUseOnlineTTS(true);
        else if (process.env.NEXT_PUBLIC_TTS_ONLINE === "0") setUseOnlineTTS(false);
        else if (savedOnline === "1") setUseOnlineTTS(true);
        else if (savedOnline === "0") setUseOnlineTTS(false);
      } catch {}

      // Populate voices; on some browsers it is async via voiceschanged
      const updateVoices = () => {
        const all = synthRef.current?.getVoices() ?? [];
        setVoices(all);
        // Auto-select first English voice if none selected
        if (!voiceURI) {
          const firstEn = all.find(v => /en/i.test(v.lang));
          if (firstEn) setVoiceURI(firstEn.voiceURI);
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
        rec.continuous = false; // restart manually on end for better control around TTS pauses
        rec.interimResults = false; rec.lang = "en-US";
        rec.onresult = (e: SpeechRecognitionEvent) => {
          const text = (e.results?.[0]?.[0]?.transcript ?? "").toString();
          if (text.trim()) {
            // sendToModel handles adding the user message; avoid double-adding
            sendRef.current(text.trim());
          }
        };
        rec.onstart = () => setSttOn(true);
        rec.onerror = () => {
          setSttOn(false);
        };
        rec.onend = () => {
          setSttOn(false);
          // Auto-restart if allowed
          if (autoSttEnabled && !muted && !speaking && !sttSuspendedRef.current) {
            try { rec.start(); setSttOn(true); } catch {/* ignore */}
          }
        };
        recRef.current = rec; setSttAvailable(true);
      }
    }
  // Note: voiceURI changes may alter available voices; auto STT logic depends on speaking/muted state
  }, [voiceURI, autoSttEnabled, muted, speaking]);

  // Preflight: if online TTS isn't configured server-side, disable it to avoid repeated 400s
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tts", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { configured?: boolean };
        if (!cancelled && data && data.configured === false) {
          setUseOnlineTTS(false);
          try { localStorage.setItem("tts.online", "0"); } catch {}
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

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
        // GestureRecognizer intentionally disabled (UI removed)
        if (GestureRecognizer) {
          try {
            gestureRecognizer = await GestureRecognizer.createFromOptions(files, {
              baseOptions: { modelAssetPath: GESTURE_MODEL, delegate: "GPU" },
              runningMode: "VIDEO",
              numHands: 1,
            });
          } catch {
            gestureRecognizer = null;
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
            const score = typeof cat?.score === "number" ? cat!.score : 0;
            const isPerson = name === "person";
              const isPhone = name === "cell phone" || name === "mobile phone" || (name.includes("phone") && !name.includes("headphone"));
              const phoneConfOk = isPhone && score >= 0.6; // require >= 60% confidence for phone
              // Draw overlay only if overlays are not hidden and: person with >= 75% confidence, or phone with >= 60% confidence
              if (!hideDetections && ((isPerson && score >= 0.75) || phoneConfOk)) {
                const bb = d.boundingBox;
                if (bb) {
                  // Mirror drawing context already applied
                  ctx.strokeStyle = "#3B82F6"; // blue-500
                  ctx.lineWidth = 3;
                  ctx.strokeRect(bb.originX, bb.originY, bb.width, bb.height);
                  // Label background
                  const label = `${name} ${Math.round((score || 0) * 100)}%`;
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
              if (isPerson && score >= 0.75) personCount += 1;
              if (phoneConfOk) phoneDetected = true;
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
  }, [MP_BASE, FACE_MODEL, GESTURE_MODEL, OD_MODEL, hideDetections]);

  // Track start times for sustained detection windows whenever env changes
  useEffect(() => {
    const now = Date.now();
    if (!detectorOn) {
      phoneDetectStartRef.current = null;
      peopleDetectStartRef.current = null;
      return;
    }
    const hasPhone = env.phone;
    const extraPeople = env.personCount > 1;
    if (hasPhone) {
      if (!phoneDetectStartRef.current) phoneDetectStartRef.current = now;
    } else {
      phoneDetectStartRef.current = null;
      alertedPhoneRef.current = false; // allow future alerts when it reappears
    }
    if (extraPeople) {
      if (!peopleDetectStartRef.current) peopleDetectStartRef.current = now;
    } else {
      peopleDetectStartRef.current = null;
      alertedPeopleRef.current = false;
    }
  }, [detectorOn, env.phone, env.personCount]);

  // Periodically evaluate sustained detection and alert with cooldown
  useEffect(() => {
    const cooldownMs = 10000; // 10s cooldown between alerts
    const tickMs = 250;
    let timer: number | null = null;
    const tick = () => {
      if (!detectorOn) return;
      const hasPhone = envRef.current.phone;
      const extraPeople = envRef.current.personCount > 1;
      const now = Date.now();
      const phoneDuration = phoneDetectStartRef.current ? now - phoneDetectStartRef.current : 0;
      const peopleDuration = peopleDetectStartRef.current ? now - peopleDetectStartRef.current : 0;
      const sustainedPhone = hasPhone && phoneDuration >= 2000;
      const sustainedPeople = extraPeople && peopleDuration >= 2000;
      const readyForAlert = now - lastEnvAlertRef.current > cooldownMs;
      let message: string | null = null;
      if (sustainedPhone && !alertedPhoneRef.current) {
        message = "Observation: A cell phone is visible in the interview. Politely remind the candidate that using a phone during the interview is not allowed and ask them to put it away. Do not reintroduce yourself; keep it brief and direct.";
        alertedPhoneRef.current = true;
      }
      if (sustainedPeople && !alertedPeopleRef.current) {
        message = message
          ? message + " Also, more than one person appears to be present; ask the candidate to continue the interview alone. Do not reintroduce yourself; keep it brief and direct."
          : "Observation: More than one person appears in the frame. Politely remind the candidate that only the applicant should be present during the interview. Do not reintroduce yourself; keep it brief and direct.";
        alertedPeopleRef.current = true;
      }
      if ((sustainedPhone || sustainedPeople) && readyForAlert && message) {
        lastEnvAlertRef.current = now;
        const fn = silentSendRef.current;
        if (fn) fn(message);
      }
    };
    // Start interval if detection is on
    if (detectorOn) {
      timer = window.setInterval(tick, tickMs);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [detectorOn]);

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
        // Pause STT while speaking
        sttSuspendedRef.current = true;
        if (recRef.current && sttOn) { try { recRef.current.stop(); } catch {} setSttOn(false); }
        const u = new SpeechSynthesisUtterance(trimmed);
        const v = voices.find(vv => vv.voiceURI === voiceURI) || null;
        if (v) u.voice = v;
        u.rate = Math.min(2, Math.max(0.5, rate || 1));
        u.pitch = 1;
        u.onstart = () => setSpeaking(true);
        u.onend = () => {
          setSpeaking(false);
          // Resume STT after TTS ends if not muted
          sttSuspendedRef.current = false;
          if (autoSttEnabled && !muted && recRef.current && !speaking) {
            try { recRef.current.start(); setSttOn(true); } catch {}
          }
        };
        synth.speak(u);
        return true;
      } catch {
        return false;
      }
    };

    if (useOnlineTTS) {
      try {
        // Pause STT while fetching / playing online TTS
        sttSuspendedRef.current = true;
        if (recRef.current && sttOn) { try { recRef.current.stop(); } catch {} setSttOn(false); }
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
          // Speed up online TTS playback (default ~1.2x, configurable)
          const envRate = Number(process.env.NEXT_PUBLIC_TTS_ONLINE_RATE ?? "");
          const desired = Number.isFinite(envRate) && envRate > 0 ? envRate : 1.2;
          audioRef.current.playbackRate = Math.min(2, Math.max(0.5, desired));
          audioRef.current.onplay = () => setSpeaking(true);
          await audioRef.current.play().catch(() => {});
          audioRef.current.onended = () => {
            setSpeaking(false);
            URL.revokeObjectURL(url);
            // Resume STT after audio ends
            sttSuspendedRef.current = false;
            if (autoSttEnabled && !muted && recRef.current && !speaking) {
              try { recRef.current.start(); setSttOn(true); } catch {}
            }
          };
          return;
        } else if (res.status === 400) {
          // Not configured or invalid request; disable Online TTS to avoid repeated errors
          setUseOnlineTTS(false);
          try { localStorage.setItem("tts.online", "0"); } catch {}
        }
      } catch {
        // fall back to browser TTS
      }
    }
    // Fallback
    playBrowserTTS();
  }, [rate, useOnlineTTS, voiceURI, voices, autoSttEnabled, muted, speaking, sttOn]);
  // Ensure STT starts initially (after mount) if available
  useEffect(() => {
    if (!recRef.current || !sttAvailable) return;
    if (autoSttEnabled && !muted && !speaking && !sttOn && !sttSuspendedRef.current) {
      try { recRef.current.start(); /* onstart sets sttOn */ } catch {}
    }
  }, [autoSttEnabled, muted, speaking, sttAvailable, sttOn]);

  // Whenever speaking flag changes from true->false, attempt restart (extra safety)
  useEffect(() => {
    if (!speaking && autoSttEnabled && !muted && recRef.current && !sttOn && !sttSuspendedRef.current) {
      try { recRef.current.start(); /* onstart sets sttOn */ } catch {}
    }
  }, [speaking, autoSttEnabled, muted, sttOn]);

  // pushUser is no longer needed because sendToModel adds the user message

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
    <div className="h-screen overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
      <div className="mx-auto max-w-screen-2xl h-full flex flex-col px-6 md:px-10 py-4 relative">
        {/* Decorative background */}
        <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.12),transparent_60%)]" />
        {/* Header */}
        <div className="flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 drop-shadow-sm flex items-center justify-center rounded-md border bg-white overflow-hidden">
              <Image src="/images/ihub-logo.png" alt="iHub Logo" width={48} height={48} unoptimized className="object-contain w-12 h-12" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AI Interview</span>
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">Beta</span>
              </h1>
              <p className="mt-1 text-xs md:text-sm text-slate-600 flex items-center gap-2">
                <span className="inline-flex items-center gap-1">Model: <span className="font-medium text-slate-800">llama3.2 (local)</span></span>
                <span className="hidden sm:inline h-1 w-1 rounded-full bg-slate-300" />
                <span className="inline-flex items-center gap-1">Quality: <span className="text-green-700">Stable</span></span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {job && (
              <div className="hidden md:flex flex-col items-end text-right">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Role</div>
                <div className="text-sm font-medium text-slate-800 line-clamp-1">{job.title}</div>
              </div>
            )}
            <button onClick={()=>router.push("/dashboard")} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white/80 backdrop-blur px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          </div>
        </div>

        {job && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white/70 backdrop-blur px-4 py-3 text-xs md:text-[13px] text-slate-700 flex flex-wrap items-center gap-3 shadow-sm">
            <span className="inline-flex items-center gap-1 font-medium text-slate-900">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>
              {job.company}
            </span>
            <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {job.location}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              {job.category}
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="10" x2="21" y2="10"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>
              Posted {new Date(job.datePosted).toLocaleDateString()}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {job.skills.slice(0,5).map(s => (
                <span key={s} className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 text-[10px] font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-12 gap-4 h-full items-stretch min-h-0">
          {/* Camera panel */}
          <div className={showTranscript ? "col-span-12 lg:col-span-5" : "col-span-12"}>
            <div className="h-full rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-4 shadow-sm flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" ry="2"/><circle cx="12" cy="11" r="3"/></svg>
                    <span>Camera</span>
                  </div>
                  <span className={`hidden sm:inline rounded-full px-2 py-1 text-[10px] font-medium shadow ${detectorAvailable ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>Detector: {detectorAvailable ? (detectorOn ? 'On' : 'Off') : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Detection toggle moved to bottom controls */}
                  {/* Voice/language selection removed by request */}
                  {/* Rate slider removed as requested */}
                  <button onClick={()=>setShowTranscript(v=>!v)} className="text-xs inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white/80 px-3 py-1.5 font-medium shadow-sm hover:bg-white transition">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a4 4 0 0 1-4 4H9l-4 3v-3H5a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v8z"/>
                      <circle cx="9" cy="11" r="1"/>
                      <circle cx="12" cy="11" r="1"/>
                      <circle cx="15" cy="11" r="1"/>
                    </svg>
                    {showTranscript ? "Hide Transcript" : "Show Transcript"}
                  </button>
                </div>
              </div>
                  <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-xl bg-black/95 mt-3 ring-1 ring-black/10 shadow-inner">
                {/* Mirror the video so it behaves like a front-facing camera */}
                <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover -scale-x-100" muted playsInline />
                {/* Keep canvas unmirrored; we mirror the drawing context for shapes but draw text normally */}
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
                {/* Removed thumbs up badge per request */}
                <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/50 backdrop-blur px-2 py-1 text-[10px] font-medium text-slate-200">Live Preview</div>
                {/* Bottom controls: mute and overlay toggle */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-10 flex items-center gap-2">
                  {sttAvailable && (
                    <button
                      type="button"
                      onClick={() => {
                        setMuted(m => !m);
                        if (!muted) { // about to mute
                          if (recRef.current && sttOn) { try { recRef.current.stop(); } catch {} }
                          setSttOn(false);
                        } else { // unmute
                          if (recRef.current && autoSttEnabled && !speaking) { try { recRef.current.start(); setSttOn(true); } catch {} }
                        }
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium shadow ring-1 ring-black/20 transition ${muted ? 'bg-rose-600 text-white' : 'bg-black/60 text-white backdrop-blur hover:bg-black/70'}`}
                      aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {muted ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9v6a3 3 0 0 0 5.12 2.12"/><path d="M9 9V5a3 3 0 0 1 5.83-.83"/><path d="M17 7v4"/><path d="M21 5v4"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                          Muted
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9v6a3 3 0 0 0 6 0V9"/><path d="M9 9V5a3 3 0 0 1 6 0v4"/><path d="M17 7v4"/><path d="M21 5v4"/></svg>
                          {speaking ? 'AI Speaking' : (sttOn ? 'Listening' : 'Idle')}
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setHideDetections(v => !v)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium shadow ring-1 ring-black/20 transition ${hideDetections ? 'bg-black/60 text-white hover:bg-black/70' : 'bg-white/80 text-slate-900 hover:bg-white'}`}
                    title={hideDetections ? 'Detection overlays hidden' : 'Detection overlays visible'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {hideDetections ? 'Overlay: Off' : 'Overlay: On'}
                  </button>
                  {detectorAvailable && (
                    <button
                      type="button"
                      onClick={() => setDetectorOn(v => !v)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium shadow ring-1 ring-black/20 transition ${detectorOn ? 'bg-white/80 text-slate-900 hover:bg-white' : 'bg-rose-600 text-white'}`}
                      title={detectorOn ? 'Disable detection' : 'Enable detection'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8"/></svg>
                      {detectorOn ? 'Detection: On' : 'Detection: Off'}
                    </button>
                  )}
                </div>
              </div>
              {/* Removed cues and tip lines as requested */}
            </div>
          </div>

          {/* Conversation / Transcript panel */}
          <div className={showTranscript ? "col-span-12 lg:col-span-7" : "hidden"}>
            <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-4 shadow-sm h-full flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a4 4 0 0 1-4 4H9l-4 3v-3H5a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v8z"/>
                    <circle cx="9" cy="11" r="1"/>
                    <circle cx="12" cy="11" r="1"/>
                    <circle cx="15" cy="11" r="1"/>
                  </svg>
                  Transcript
                </div>
                <div className="text-[11px] text-slate-500">{busy ? "AI is responding…" : "Ready"}</div>
              </div>
              <div className="mt-2 flex-1 min-h-0 overflow-y-auto rounded-md border p-2 bg-white/80">
                {messages.length === 0 ? (
                  <div className="h-full grid place-items-center text-slate-500 text-sm">Starting interview…</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {messages.map(m => (
                      <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] rounded-xl px-3 py-2 text-sm shadow-sm ${m.role === "user" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white" : "bg-slate-100 text-slate-900"}`}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {error && <div className="text-xs text-rose-600">Error: {error}</div>}
                  </div>
                )}
              </div>
              {/* Composer */}
              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                <div className="inline-flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${sttOn && !muted ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  {muted ? 'Microphone muted' : (speaking ? 'AI speaking…' : (sttOn ? 'Listening (auto transcription)' : 'Idle'))}
                </div>
                <div>Speech is auto-sent when you finish speaking.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
