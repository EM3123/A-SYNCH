import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  askPerspectivePerson,
  type AskResponse,
  type PartBConversationTurn,
  type PersonProfile,
} from '../api';
import './PerspectiveVoiceAgent.css';
import { DEFAULT_VOICE, KOKORO_VOICES, type KokoroVoice } from '../../../lib/speech/config';

type VoiceState = 'ready' | 'listening' | 'transcribing' | 'checking' | 'preparing' | 'speaking' | 'stopped' | 'unsupported' | 'permission-denied';
type VoiceChoice = KokoroVoice | 'browser';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

interface TranscriptTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: AskResponse;
}

interface Props {
  person: PersonProfile;
  requesterId?: string;
  onClose?: () => void;
  onLatestResponse?: (response: AskResponse) => void;
}

const STATE_LABELS: Record<VoiceState, string> = {
  ready: 'Ready',
  listening: 'Listening',
  transcribing: 'Transcribing',
  checking: 'Checking approved perspective',
  preparing: 'Preparing local voice…',
  speaking: 'Speaking',
  stopped: 'Stopped',
  unsupported: 'Voice input unavailable',
  'permission-denied': 'Microphone permission denied',
};

const SUGGESTIONS = [
  'Would you support a 10% beta rollout today?',
  'Why 10% instead of 50%?',
  'What would make you comfortable increasing it?',
];

function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const voiceWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
}

function turnHistory(turns: TranscriptTurn[]): PartBConversationTurn[] {
  return turns.map((turn) => ({ role: turn.role, content: turn.content }));
}

function guidanceLabel(response: AskResponse): string {
  if (response.brief.trust.decision === 'needs-human') return 'Needs the person';
  if (response.brief.trust.decision === 'supported') return 'Supported guidance';
  return 'Stated perspective';
}

export default function PerspectiveVoiceAgent({ person, requesterId, onClose, onLatestResponse }: Props) {
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>('ready');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [voiceChoice, setVoiceChoice] = useState<VoiceChoice>(DEFAULT_VOICE);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>([]);
  const latestSpokenRef = useRef('');
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutedRef = useRef(false);
  const mountedRef = useRef(true);
  const requestBusyRef = useRef(false);
  const playbackEpochRef = useRef(0);
  const voiceChoiceRef = useRef<VoiceChoice>(DEFAULT_VOICE);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechFetchRef = useRef<AbortController | null>(null);

  const cancelSpeech = useCallback(() => {
    playbackEpochRef.current += 1;
    speechFetchRef.current?.abort();
    speechFetchRef.current = null;
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onplaying = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    if (mountedRef.current) setNeedsAudioTap(false);
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    speechTimerRef.current = null;
    if (utteranceRef.current) {
      utteranceRef.current.onstart = null;
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);

  const cancelRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.abort();
    }
  }, []);

  useEffect(() => { turnsRef.current = turns; }, [turns]);
  useEffect(() => {
    mountedRef.current = true;
    const synth = window.speechSynthesis;
    const refreshVoices = () => { voicesRef.current = synth?.getVoices() ?? []; };
    refreshVoices();
    synth?.addEventListener('voiceschanged', refreshVoices);
    return () => {
      mountedRef.current = false;
      synth?.removeEventListener('voiceschanged', refreshVoices);
      cancelRecognition();
      cancelSpeech();
    };
  }, [cancelRecognition, cancelSpeech]);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns.length, voiceState]);

  const latestResponse = [...turns].reverse().find((turn) => turn.response)?.response;

  const speakBrowser = useCallback((text: string) => {
    if (!mountedRef.current || mutedRef.current) return;
    cancelSpeech();
    setAudioError(null);
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      setVoiceState('ready');
      setAudioError('Spoken replies are unavailable in this browser. Open localhost:3000 in Chrome or Safari to hear them.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    utterance.lang = 'en-US';
    utterance.rate = 1.02;
    utterance.volume = 1;
    const voices = synth.getVoices().length ? synth.getVoices() : voicesRef.current;
    const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
    const genericVoice = english.find((voice) => voice.localService && voice.default)
      ?? english.find((voice) => voice.localService) ?? english[0];
    if (genericVoice) utterance.voice = genericVoice;
    const isCurrent = () => mountedRef.current && utteranceRef.current === utterance;
    utterance.onstart = () => {
      if (!isCurrent()) return;
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
      setVoiceState('speaking');
    };
    utterance.onend = () => {
      if (!isCurrent()) return;
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      utteranceRef.current = null;
      setVoiceState('ready');
    };
    utterance.onerror = (event) => {
      if (!isCurrent()) return;
      cancelSpeech();
      setVoiceState('ready');
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setAudioError(event.error === 'not-allowed'
          ? 'Your browser blocked automatic sound. Tap Read aloud on the reply to start playback.'
          : 'Voice playback could not start. Try Test voice or Read aloud; check that your browser and speakers are unmuted.');
      }
    };
    speechTimerRef.current = setTimeout(() => {
      if (!isCurrent()) return;
      cancelSpeech();
      setVoiceState('ready');
      setAudioError('Sound did not start. Tap Read aloud on the reply, or try Test voice.');
    }, 5000);
    try {
      synth.resume();
      synth.speak(utterance);
    } catch {
      cancelSpeech();
      setVoiceState('ready');
      setAudioError('Voice playback is unavailable here. Try this demo in Chrome or Safari.');
    }
  }, [cancelSpeech]);

  const speak = useCallback((text: string) => {
    if (!mountedRef.current || mutedRef.current) return;
    if (voiceChoiceRef.current === 'browser') {
      speakBrowser(text);
      return;
    }
    cancelSpeech();
    setAudioError(null);
    setVoiceState('preparing');
    const epoch = playbackEpochRef.current;
    const voice = voiceChoiceRef.current;
    const controller = new AbortController();
    speechFetchRef.current = controller;
    const isCurrent = () => mountedRef.current && !mutedRef.current && playbackEpochRef.current === epoch;
    // First use may download the weights. Later calls reuse the local model.
    const timeout = setTimeout(() => controller.abort(), 90000);
    void (async () => {
      try {
        const response = await fetch('/api/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice }),
          signal: controller.signal,
        });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/wav')) {
          throw new Error('Local speech unavailable');
        }
        const blob = await response.blob();
        if (!isCurrent()) return;
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplaying = () => {
          if (!isCurrent()) return;
          setNeedsAudioTap(false);
          setAudioError(null);
          setVoiceState('speaking');
        };
        audio.onended = () => {
          if (!isCurrent()) return;
          setVoiceState('ready');
          // Keep no generated conversation audio beyond the active playback.
          cancelSpeech();
        };
        audio.onerror = () => {
          if (!isCurrent()) return;
          speakBrowser(text);
          setAudioError('Local audio could not play. Using the browser voice.');
        };
        try {
          await audio.play();
        } catch (cause) {
          if (!isCurrent()) return;
          if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
            // Retain this WAV so the next explicit click plays synchronously,
            // without another fetch losing the browser's user activation.
            setNeedsAudioTap(true);
            setVoiceState('ready');
            setAudioError('Your browser blocked automatic sound. Tap Play voice below.');
          } else {
            throw cause;
          }
        }
      } catch {
        if (!isCurrent()) return;
        speakBrowser(text);
        setAudioError('Kokoro is unavailable right now. Using the browser voice.');
      } finally {
        clearTimeout(timeout);
        if (speechFetchRef.current === controller) speechFetchRef.current = null;
      }
    })();
  }, [cancelSpeech, speakBrowser]);

  const playPreparedAudio = () => {
    const audio = audioRef.current;
    if (!audio || mutedRef.current) return;
    const epoch = playbackEpochRef.current;
    void audio.play().catch(() => {
      if (mountedRef.current && playbackEpochRef.current === epoch) {
        setAudioError('Playback could not start. Check that your browser and speakers are unmuted, or choose Browser voice.');
      }
    });
  };

  const readAloud = (text: string) => {
    cancelRecognition();
    mutedRef.current = false;
    setMuted(false);
    speak(text);
  };

  const submitTurn = useCallback(async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || requestBusyRef.current) return;
    requestBusyRef.current = true;
    setWaiting(true);
    cancelRecognition();
    cancelSpeech();
    const playbackEpoch = playbackEpochRef.current;
    const priorHistory = turnHistory(turnsRef.current);
    setError(null);
    setCopied(false);
    setVoiceState('checking');
    setDraft('');
    setTurns((current) => [...current, {
      id: `user-${Date.now()}-${current.length}`,
      role: 'user',
      content: question,
    }]);
    try {
      const response = await askPerspectivePerson(person.id, question, priorHistory, requesterId);
      if (!mountedRef.current) return;
      setTurns((current) => [...current, {
        id: response.requestId,
        role: 'assistant',
        content: response.brief.answer,
        response,
      }]);
      onLatestResponse?.(response);
      latestSpokenRef.current = response.brief.answer;
      setVoiceState('ready');
      if (playbackEpochRef.current === playbackEpoch) speak(response.brief.answer);
    } catch (cause) {
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : 'The perspective conversation could not continue.');
      setVoiceState('ready');
    } finally {
      requestBusyRef.current = false;
      if (mountedRef.current) setWaiting(false);
    }
  }, [cancelRecognition, cancelSpeech, onLatestResponse, person.id, requesterId, speak]);

  const startListening = () => {
    setError(null);
    setCopied(false);
    cancelSpeech();
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setVoiceState('unsupported');
      setError('Voice recognition is not available in this browser. Type below to continue the same perspective conversation.');
      return;
    }

    cancelRecognition();
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    let finalSubmitted = false;

    recognition.onstart = () => setVoiceState('listening');
    recognition.onresult = (event) => {
      let transcript = '';
      let finalText = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        transcript += result[0]?.transcript ?? '';
        if (result.isFinal) finalText += result[0]?.transcript ?? '';
      }
      setDraft(transcript.trim());
      if (finalText.trim() && !finalSubmitted) {
        finalSubmitted = true;
        setVoiceState('transcribing');
        void submitTurn(finalText);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceState('permission-denied');
        setError('Microphone access was denied. Nothing was recorded; type below to continue.');
      } else {
        setVoiceState('ready');
        setError(`Voice input stopped (${event.error}). Type below or try again.`);
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!finalSubmitted) setVoiceState((state) => state === 'listening' || state === 'transcribing' ? 'ready' : state);
    };
    try {
      recognition.start();
    } catch {
      setVoiceState('ready');
      setError('Voice input could not start. Type below or try again.');
    }
  };

  const stopAudio = () => {
    cancelRecognition();
    cancelSpeech();
    setVoiceState(requestBusyRef.current ? 'checking' : 'stopped');
  };

  const endConversation = () => {
    stopAudio();
    mountedRef.current = false;
    onClose?.();
  };

  const replay = () => {
    if (latestSpokenRef.current) readAloud(latestSpokenRef.current);
  };

  const submitTyped = (event: FormEvent) => {
    event.preventDefault();
    void submitTurn(draft);
  };

  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitTurn(draft);
    }
  };

  const copyHandoff = async () => {
    if (!latestResponse) return;
    const note = `Hi ${person.name}, ${latestResponse.brief.nextStep}`;
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
    } catch {
      setError('Copy did not work. Select the next step in the transcript and copy it manually.');
    }
  };

  const voiceActive = voiceState === 'listening' || voiceState === 'transcribing' || voiceState === 'checking' || voiceState === 'preparing' || voiceState === 'speaking';

  return (
    <main className="perspective-shell">
      <header className="perspective-topbar">
        <div>
          <span className="part-b-brand"><i /> A-SYNCH</span>
          <span className="part-b-workspace">Corvid Labs</span>
        </div>
        <button type="button" onClick={endConversation}>← Back to team</button>
      </header>

      <section className="part-b-agent" aria-labelledby={`part-b-title-${person.id}`}>
        <header className="part-b-header">
          <div className="part-b-identity">
            <span className="part-b-avatar" aria-hidden="true">{person.name.split(' ').map((part) => part[0]).join('')}</span>
            <div>
              <span className="part-b-kicker">OWNER-CONFIRMED PERSPECTIVE</span>
              <h1 id={`part-b-title-${person.id}`}>Talk through it with<br />{person.name}’s <em>context agent.</em></h1>
              <p>{person.role.replace(/\s*\(Atlas\)\s*/i, '')} <span>·</span> {person.availabilityLabel}</p>
            </div>
          </div>
          <div className="part-b-state" data-state={voiceState} role="status">
            <span aria-hidden="true" /> {STATE_LABELS[voiceState]}
          </div>
        </header>

        <div className="part-b-boundary" role="note">
          <span className="boundary-icon">✓</span>
          <p><strong>Perspective, with proof.</strong> Every answer is grounded in reasoning {person.name} confirmed. Approval always stays with {person.name.split(' ')[0]}.</p>
        </div>

        <div className={`part-b-conversation ${turns.length ? 'part-b-conversation-active' : ''}`}>
          {turns.length === 0 ? (
            <div className="part-b-empty">
              <button type="button" className="voice-orb" onClick={startListening} aria-label="Start voice conversation">
                <span className="orb-rings" aria-hidden="true"><i /><i /><i /></span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Zm-6-4a1 1 0 0 1 2 0V12a4 4 0 0 0 8 0v-.5a1 1 0 1 1 2 0V12a6 6 0 0 1-5 5.92V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.08A6 6 0 0 1 6 12v-.5Z" /></svg>
              </button>
              <h2>Start with your voice</h2>
              <p>Ask a judgment question. The context agent brings {person.name.split(' ')[0]}’s stated priorities, tradeoffs, and decision boundaries into the conversation.</p>
              <div className="part-b-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => void submitTurn(suggestion)} disabled={waiting}>
                    {suggestion} <span>↗</span>
                  </button>
                ))}
              </div>
              <small>Replies are read aloud automatically · generic AI voices, never the person’s voice</small>
            </div>
          ) : (
            <div className="part-b-transcript" aria-live="polite">
              {turns.map((turn) => (
                <article key={turn.id} className={`part-b-turn part-b-turn-${turn.role}`}>
                  <span className="turn-author">{turn.role === 'user' ? 'You' : `${person.name.split(' ')[0]}'s context agent`}</span>
                  <div className="turn-message">
                    {turn.response && (
                      <div className="turn-meta">
                        <strong data-decision={turn.response.brief.trust.decision}>{guidanceLabel(turn.response)}</strong>
                        <span>{turn.response.meta.usedFallback ? 'Verified local answer' : 'OpenRouter + Trust Layer'}</span>
                      </div>
                    )}
                    <p>{turn.content}</p>
                    {turn.response && (
                      <>
                        <button type="button" className="read-reply" disabled={waiting} onClick={() => readAloud(turn.content)}>Read aloud</button>
                        <details className="part-b-proof">
                          <summary>Why this answer <span>{turn.response.sources.length} source{turn.response.sources.length === 1 ? '' : 's'} →</span></summary>
                          <div>
                            {turn.response.brief.claims.map((claim, index) => (
                              <p key={`${claim.text}-${index}`}><i /> {claim.text}</p>
                            ))}
                            <ul>
                              {turn.response.sources.map((source) => (
                                <li key={source.id}>
                                  <span>{source.title}</span>
                                  <small>{source.sourceLabel} · {new Date(source.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </details>
                        {turn.response.brief.trust.requiresHuman && turn.response.brief.trust.decision === 'needs-human' && (
                          <button type="button" className="handoff-button" onClick={() => void copyHandoff()}>
                            {copied ? 'Confirmation request copied ✓' : `Copy confirmation request for ${person.name.split(' ')[0]}`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              ))}
              {waiting && (
                <div className="part-b-thinking"><i /><i /><i /><span>Checking perspective, evidence, and authority…</span></div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}

          {error && <p className="part-b-error" role="alert">{error}</p>}
          {audioError && <p className="part-b-error" role="alert">{audioError}</p>}
          {needsAudioTap && <button type="button" className="part-b-play-audio" onClick={playPreparedAudio}>▶ Play voice</button>}

          <div className="part-b-input-dock">
            <form className="part-b-compose" onSubmit={submitTyped}>
              <button
                type="button"
                className="part-b-mic"
                onClick={voiceState === 'listening' ? stopAudio : startListening}
                disabled={waiting}
                aria-label={voiceState === 'listening' ? 'Stop listening' : 'Start push-to-talk'}
                data-active={voiceState === 'listening'}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Zm-6-4a1 1 0 0 1 2 0V12a4 4 0 0 0 8 0v-.5a1 1 0 1 1 2 0V12a6 6 0 0 1-5 5.92V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.08A6 6 0 0 1 6 12v-.5Z" /></svg>
              </button>
              <textarea
                id={`part-b-input-${person.id}`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={submitOnEnter}
                placeholder={`Ask ${person.name.split(' ')[0]}'s context agent anything…`}
                aria-label={`Message ${person.name}'s context agent`}
                maxLength={1500}
                rows={1}
              />
              <button type="submit" className="part-b-send" disabled={!draft.trim() || waiting} aria-label="Send message">↗</button>
            </form>
            <div className="part-b-controls">
              <span><i data-state={voiceState} /> {STATE_LABELS[voiceState]}</span>
              <div>
                <label className="part-b-voice-picker">
                  <span>Voice</span>
                  <select
                    aria-label="Reply voice"
                    title="Generic synthetic voices, not the selected person's voice"
                    value={voiceChoice}
                    onChange={(event) => {
                      const value = event.target.value as VoiceChoice;
                      cancelSpeech();
                      voiceChoiceRef.current = value;
                      setVoiceChoice(value);
                      setAudioError(null);
                      setVoiceState(requestBusyRef.current ? 'checking' : 'ready');
                    }}
                  >
                    {KOKORO_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.label} · Kokoro</option>)}
                    <option value="browser">Browser voice</option>
                  </select>
                </label>
                {voiceActive && <button type="button" onClick={stopAudio}>Stop</button>}
                <button type="button" onClick={() => readAloud('Sound is on. I will read every reply aloud.')} disabled={waiting}>Test voice</button>
                <button type="button" onClick={replay} disabled={!latestResponse || waiting}>Replay</button>
                <button
                  type="button"
                  aria-label="Read replies aloud"
                  aria-pressed={!muted}
                  onClick={() => {
                    mutedRef.current = !mutedRef.current;
                    setMuted(mutedRef.current);
                    if (mutedRef.current) cancelSpeech();
                    setVoiceState(requestBusyRef.current ? 'checking' : 'ready');
                  }}
                >
                  {muted ? 'Spoken replies: Off' : 'Spoken replies: On'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
