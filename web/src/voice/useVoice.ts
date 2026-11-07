// Push-to-talk voice for talking to a context agent.
// - Speech recognition starts only when the user presses the mic button (that press is what
//   triggers the browser's permission prompt). Nothing is recorded in the background.
// - Audio is never stored or sent anywhere by this code; the browser turns speech into text,
//   and only the text goes to the person-chat API.
// - Replies can be read aloud with speechSynthesis, and stopped or replayed.
// - If recognition is missing or permission is denied, state says so and typing still works.
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceState =
  | 'unsupported' // no speech recognition in this browser: type instead
  | 'denied' // microphone permission refused: type instead
  | 'ready'
  | 'listening'
  | 'transcribing'
  | 'checking' // the agent is looking at context (set by the caller)
  | 'speaking';

// Minimal typings for the Web Speech API, which is not in every TypeScript DOM lib.
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice() {
  const [state, setState] = useState<VoiceState>('ready');
  const [interim, setInterim] = useState('');
  const [canSpeak, setCanSpeak] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef('');
  const onFinalRef = useRef<((text: string) => void) | null>(null);
  const lastSpoken = useRef('');

  // Detect support after mount, so the server render and first client render match.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!recognitionCtor()) setState('unsupported');
      setCanSpeak('speechSynthesis' in window);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      recRef.current?.abort();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  const listen = useCallback((onFinal: (text: string) => void) => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setState('unsupported');
      return;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    finalRef.current = '';
    onFinalRef.current = onFinal;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      finalRef.current = text.trim();
      setInterim(text.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setState('denied');
      else setState('ready');
    };
    rec.onend = () => {
      recRef.current = null;
      const text = finalRef.current;
      setState((s) => (s === 'denied' ? s : text ? 'transcribing' : 'ready'));
      if (text) onFinalRef.current?.(text);
    };
    recRef.current = rec;
    setInterim('');
    setState('listening');
    try {
      rec.start();
    } catch {
      setState('ready');
    }
  }, []);

  // Stop listening; whatever was heard is submitted.
  const stopListening = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window) || !text) {
      setState((s) => (s === 'unsupported' || s === 'denied' ? s : 'ready'));
      return;
    }
    window.speechSynthesis.cancel();
    lastSpoken.current = text;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.onend = () => setState((s) => (s === 'speaking' ? 'ready' : s));
    u.onerror = () => setState((s) => (s === 'speaking' ? 'ready' : s));
    setState('speaking');
    window.speechSynthesis.speak(u);
  }, []);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setState((s) => (s === 'speaking' ? 'ready' : s));
  }, []);

  const replay = useCallback(() => {
    if (lastSpoken.current) speak(lastSpoken.current);
  }, [speak]);

  return { state, setState, interim, canSpeak, listen, stopListening, speak, stopSpeaking, replay };
}
