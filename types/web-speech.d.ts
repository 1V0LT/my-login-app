// Minimal ambient types for Web Speech API used in the app
// These are intentionally small to satisfy TypeScript in strict mode.

interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  length: number;
  [index: number]: SpeechRecognitionResultItem;
  isFinal?: boolean;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResult[];
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onaudioend?: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudiostart?: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend?: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror?: ((this: SpeechRecognition, ev: Event) => void) | null;
  onnomatch?: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult?: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundend?: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundstart?: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend?: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart?: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart?: ((this: SpeechRecognition, ev: Event) => void) | null;
}

interface Window {
  webkitSpeechRecognition?: { new (): SpeechRecognition };
  SpeechRecognition?: { new (): SpeechRecognition };
}
