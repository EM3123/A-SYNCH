import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  askPerspectivePerson,
  type AskResponse,
  type PartBConversationTurn,
  type PersonProfile,
} from '../api';
import './PerspectiveVoiceAgent.css';

type VoiceState = 'ready' | 'listening' | 'transcribing' | 'checking' | 'speaking' | 'stopped' | 'unsupported' | 'permission-denied';

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
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>([]);
  const latestSpokenRef = useRef('');
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { turnsRef.current = turns; }, [turns]);
  useEffect(() => () => {
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns.length, voiceState]);

  const latestResponse = [...turns].reverse().find((turn) => turn.response)?.response;

  const speak = useCallback((text: string) => {
    latestSpokenRef.current = text;
    if (muted || !('speechSynthesis' in window)) {
      setVoiceState('ready');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.02;
    const genericVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith('en'));
    if (genericVoice) utterance.voice = genericVoice;
    utterance.onstart = () => setVoiceState('speaking');
    utterance.onend = () => setVoiceState('ready');
    utterance.onerror = () => setVoiceState('ready');
    window.speechSynthesis.speak(utterance);
  }, [muted]);

  const submitTurn = useCallback(async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || voiceState === 'checking') return;
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
      setTurns((current) => [...current, {
        id: response.requestId,
        role: 'assistant',
        content: response.brief.answer,
        response,
      }]);
      onLatestResponse?.(response);
      speak(response.brief.answer);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The perspective conversation could not continue.');
      setVoiceState('ready');
    }
  }, [onLatestResponse, person.id, requesterId, speak, voiceState]);

  const startListening = () => {
    setError(null);
    setCopied(false);
    window.speechSynthesis?.cancel();
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setVoiceState('unsupported');
      setError('Voice recognition is not available in this browser. Type below to continue the same perspective conversation.');
      return;
    }

    recognitionRef.current?.abort();
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
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    setVoiceState('stopped');
  };

  const endConversation = () => {
    stopAudio();
    onClose?.();
  };

  const replay = () => {
    if (latestSpokenRef.current) speak(latestSpokenRef.current);
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

  const voiceActive = voiceState === 'listening' || voiceState === 'transcribing' || voiceState === 'checking' || voiceState === 'speaking';

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
                  <button key={suggestion} type="button" onClick={() => void submitTurn(suggestion)} disabled={voiceState === 'checking'}>
                    {suggestion} <span>↗</span>
                  </button>
                ))}
              </div>
              <small>Microphone starts only when you press it · typing works too</small>
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
              {voiceState === 'checking' && (
                <div className="part-b-thinking"><i /><i /><i /><span>Checking perspective, evidence, and authority…</span></div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}

          {error && <p className="part-b-error" role="alert">{error}</p>}

          <div className="part-b-input-dock">
            <form className="part-b-compose" onSubmit={submitTyped}>
              <button
                type="button"
                className="part-b-mic"
                onClick={voiceState === 'listening' ? stopAudio : startListening}
                disabled={voiceState === 'checking'}
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
              <button type="submit" className="part-b-send" disabled={!draft.trim() || voiceState === 'checking'} aria-label="Send message">↗</button>
            </form>
            <div className="part-b-controls">
              <span><i data-state={voiceState} /> {STATE_LABELS[voiceState]}</span>
              <div>
                {voiceActive && <button type="button" onClick={stopAudio}>Stop</button>}
                <button type="button" onClick={replay} disabled={!latestResponse}>Replay</button>
                <button
                  type="button"
                  aria-pressed={muted}
                  onClick={() => {
                    setMuted((value) => !value);
                    window.speechSynthesis?.cancel();
                    setVoiceState('ready');
                  }}
                >
                  {muted ? 'Sound on' : 'Mute'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
