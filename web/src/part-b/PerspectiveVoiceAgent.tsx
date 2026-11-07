import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
  'Would you support a 10% Atlas beta today?',
  'Why 10% instead of 50%?',
  'What would make you comfortable increasing it?',
  'Approve it for me.',
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

  useEffect(() => { turnsRef.current = turns; }, [turns]);
  useEffect(() => () => {
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  const history = useMemo(() => turnHistory(turns), [turns]);
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

  return (
    <section className="part-b-agent" aria-labelledby={`part-b-title-${person.id}`}>
      <header className="part-b-header">
        <div className="part-b-identity">
          <span className="part-b-avatar" aria-hidden="true">{person.name.split(' ').map((part) => part[0]).join('')}</span>
          <div>
            <span className="part-b-kicker">Perspective conversation</span>
            <h2 id={`part-b-title-${person.id}`}>{person.name}’s context agent</h2>
            <p>{person.role} · {person.availabilityLabel}</p>
          </div>
        </div>
        <div className="part-b-state" data-state={voiceState} role="status">
          <span aria-hidden="true" /> {STATE_LABELS[voiceState]}
        </div>
      </header>

      <div className="part-b-boundary" role="note">
        <strong>Approved perspective, not role-play.</strong>
        <span>This agent cites reasoning {person.name} explicitly confirmed. It cannot infer personality or approve on their behalf.</span>
      </div>

      <div className="part-b-layout">
        <div className="part-b-main">
          {turns.length === 0 ? (
            <div className="part-b-empty">
              <h3>Work through the decision out loud</h3>
              <p>Ask about tradeoffs, review conditions, priorities, or what evidence would change the decision.</p>
              <button type="button" className="part-b-primary" onClick={startListening}>Start voice conversation</button>
              <span>Microphone access starts only after you press this button. Audio is not passively recorded.</span>
            </div>
          ) : (
            <div className="part-b-transcript" aria-live="polite">
              {turns.map((turn) => (
                <article key={turn.id} className={`part-b-turn part-b-turn-${turn.role}`}>
                  <span>{turn.role === 'user' ? 'You' : `${person.name} · context agent`}</span>
                  <p>{turn.content}</p>
                  {turn.response && (
                    <div className="part-b-proof">
                      <strong data-decision={turn.response.brief.trust.decision}>{guidanceLabel(turn.response)}</strong>
                      <details>
                        <summary>{turn.response.sources.length} cited record{turn.response.sources.length === 1 ? '' : 's'}</summary>
                        <ul>
                          {turn.response.sources.map((source) => (
                            <li key={source.id}>
                              <span>{source.title}</span>
                              <small>{source.sourceLabel} · {new Date(source.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  )}
                </article>
              ))}
              {voiceState === 'checking' && <p className="part-b-thinking">Checking approved perspective and decision boundaries…</p>}
            </div>
          )}

          <form className="part-b-compose" onSubmit={submitTyped}>
            <label htmlFor={`part-b-input-${person.id}`}>Voice transcript or typed message</label>
            <div>
              <textarea
                id={`part-b-input-${person.id}`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Ask ${person.name}’s context agent about a decision…`}
                maxLength={1500}
                rows={2}
              />
              <button type="button" className="part-b-mic" onClick={startListening} disabled={voiceState === 'checking'} aria-label="Start push-to-talk">
                {voiceState === 'listening' ? 'Listening…' : 'Push to talk'}
              </button>
              <button type="submit" disabled={!draft.trim() || voiceState === 'checking'}>Send</button>
            </div>
          </form>

          {error && <p className="part-b-error" role="alert">{error}</p>}
        </div>

        <aside className="part-b-side" aria-label="Conversation guidance and controls">
          <div>
            <span className="part-b-kicker">Try the demo path</span>
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => { setDraft(suggestion); void submitTurn(suggestion); }} disabled={voiceState === 'checking'}>
                {suggestion}
              </button>
            ))}
          </div>

          {latestResponse && (
            <div className="part-b-current">
              <span className="part-b-kicker">Current boundary</span>
              <strong>{guidanceLabel(latestResponse)}</strong>
              <p>{latestResponse.brief.nextStep}</p>
              {latestResponse.brief.trust.requiresHuman && (
                <button type="button" onClick={() => void copyHandoff()}>{copied ? 'Request copied' : `Copy request for ${person.name}`}</button>
              )}
            </div>
          )}

          <div className="part-b-controls" aria-label="Voice controls">
            <button type="button" onClick={stopAudio}>Stop</button>
            <button type="button" onClick={replay} disabled={!latestResponse}>Replay</button>
            <button type="button" aria-pressed={muted} onClick={() => { setMuted((value) => !value); window.speechSynthesis?.cancel(); }}>
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" onClick={endConversation}>End conversation</button>
          </div>

          <p className="part-b-privacy">Generic assistant voice · no passive recording · typed fallback always available</p>
        </aside>
      </div>

      <span className="part-b-history-count">{history.length} prior turn{history.length === 1 ? '' : 's'} available to this conversation</span>
    </section>
  );
}
