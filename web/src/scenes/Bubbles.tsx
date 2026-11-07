// Speech bubbles that belong to the fish. The answer lives with the person who gave it,
// instead of in a detached panel. Bubbles are DOM (selectable, readable by screen readers)
// on a solid background, so waves never sit on top of the words.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { askPerson, type AskResponse, type PersonProfile } from '../api';
import { labelText } from '../data';
import type { OceanScene } from '../scene/OceanScene';
import { useVoice } from '../voice/useVoice';

// ---- Anchoring ----

interface AnchoredProps {
  scene: OceanScene | null;
  anchorId: string;
  width?: number;
  className?: string;
  label: string;
  children: ReactNode;
}

// Follows a fish every frame. Sits above the fish, keeps inside the screen, and stays left of
// the question column so it never covers the form.
export function AnchoredBubble({ scene, anchorId, width = 380, className = '', label, children }: AnchoredProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const place = () => {
      const el = ref.current;
      const p = scene?.screenPos(anchorId);
      if (el && p) {
        const side = document.querySelector('.side')?.getBoundingClientRect();
        const rightLimit = (side && window.innerWidth > 760 ? side.left : window.innerWidth) - 16;
        const w = Math.min(width, rightLimit - 16);
        const h = el.offsetHeight;
        let left = p.x - w * 0.3;
        left = Math.max(16, Math.min(left, rightLimit - w));
        let top = p.y - h - 44;
        const below = top < 64;
        if (below) top = p.y + 44;
        top = Math.max(64, Math.min(top, window.innerHeight - h - 12));
        el.style.width = `${w}px`;
        el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
        el.dataset.below = below ? 'true' : 'false';
        if (tailRef.current) {
          const tx = Math.max(18, Math.min(w - 18, p.x - left));
          tailRef.current.style.left = `${Math.round(tx)}px`;
        }
      }
      raf = requestAnimationFrame(place);
    };
    raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [scene, anchorId, width]);

  return (
    <div ref={ref} className={`bubble ${className}`} role="dialog" aria-label={label}>
      {children}
      <span ref={tailRef} className="bubble-tail" aria-hidden="true" />
    </div>
  );
}

const firstName = (name: string) => name.split(' ')[0];

// ---- Talk to one person's context agent ----

interface Turn {
  q: string;
  r?: AskResponse;
  error?: string;
  viaVoice: boolean;
}

interface FishTalkProps {
  scene: OceanScene | null;
  person: PersonProfile;
  requesterId: string;
  firstQuestion?: string;
  onClose: () => void;
  onResponse: (r: AskResponse) => void;
  onOpenSources: (r: AskResponse) => void;
  onCopy: (text: string) => void;
}

export function FishTalk({ scene, person, requesterId, firstQuestion, onClose, onResponse, onOpenSources, onCopy }: FishTalkProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const voice = useVoice();
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);
  const name = firstName(person.name);

  // Call the fish up while the bubble is open; let it go home when it closes.
  useEffect(() => {
    scene?.focus(person.id);
    return () => {
      scene?.focus(null);
      scene?.setSpeaking(null);
      scene?.setListening(false);
    };
  }, [scene, person.id]);

  useEffect(() => {
    scene?.setListening(voice.state === 'listening');
    scene?.setSpeaking(voice.state === 'speaking' ? person.id : null);
  }, [scene, voice.state, person.id]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns]);

  const ask = async (q: string, viaVoice: boolean) => {
    const question = q.trim();
    if (!question || pending) return;
    setPending(true);
    setText('');
    setTurns((t) => [...t, { q: question, viaVoice }]);
    if (viaVoice) voice.setState('checking');
    try {
      const r = await askPerson(person.id, question, requesterId);
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, r } : turn)));
      onResponse(r);
      if (viaVoice && voice.canSpeak) voice.speak(r.brief.answer);
      else {
        // Even without speech, the fish visibly "talks" for a moment as the answer arrives.
        if (viaVoice) voice.setState('ready');
        scene?.setSpeaking(person.id);
        window.setTimeout(() => scene?.setSpeaking(null), 2200);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, error: msg } : turn)));
      if (viaVoice) voice.setState('ready');
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  // A question handed over by a demo chip is asked once, as soon as the bubble opens.
  useEffect(() => {
    if (firstQuestion && !asked.current) {
      asked.current = true;
      void ask(firstQuestion, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstQuestion]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(text, false);
  };

  const mic = () => {
    if (voice.state === 'listening') voice.stopListening();
    else voice.listen((heard) => void ask(heard, true));
  };

  const latest = [...turns].reverse().find((t) => t.r)?.r;
  const statusText: Record<string, string> = {
    unsupported: 'Voice is not available in this browser. Type instead.',
    denied: 'Microphone permission was refused. Type instead, or allow the mic and try again.',
    ready: voice.canSpeak ? 'Press the mic and speak. Replies are read aloud.' : 'Press the mic and speak.',
    listening: 'Listening… press again when you are done.',
    transcribing: 'Got it. Sending your words…',
    checking: `Checking ${name}'s context…`,
    speaking: `${name}'s agent is speaking.`,
  };
  const micDisabled = voice.state === 'unsupported' || pending || voice.state === 'checking';

  return (
    <AnchoredBubble scene={scene} anchorId={person.id} width={400} className="bubble-talk" label={`${name}'s context agent`}>
      <div className="bubble-head">
        <div>
          <span className="eyebrow">Context agent</span>
          <h2>{name}'s context agent</h2>
          <p className="dim">{person.role} · {person.availabilityLabel}</p>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="End conversation">×</button>
      </div>
      <p className="boundary">Answers from {name}'s stated principles and sources. This is not {name} speaking, and it cannot approve anything for {name}.</p>

      <div ref={logRef} className="bubble-log" aria-live="polite">
        {turns.length === 0 && <p className="dim">Ask {name}'s agent anything about their work.</p>}
        {turns.map((t, i) => (
          <div key={i} className="turn">
            <p className="you">{t.viaVoice && <span className="dim">Said · </span>}{t.q}</p>
            {t.error && <p className="err">{t.error}</p>}
            {!t.r && !t.error && <p className="thinking">Checking {name}'s context…</p>}
            {t.r && (
              <div className="agent">
                <span className={`label label-${t.r.brief.trust.decision}`}>{labelText[t.r.brief.trust.decision]}</span>
                {t.r.brief.answer.split('\n').map((line, j) => <p key={j}>{line}</p>)}
                {t.r.brief.trust.requiresHuman && (
                  <button type="button" className="link" onClick={() => onCopy(`Hi ${name}, ${t.r!.brief.nextStep}`)}>
                    Copy request for {name}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="voice-row">
        <button
          type="button"
          className={`mic mic-${voice.state}`}
          onClick={mic}
          disabled={micDisabled}
          aria-pressed={voice.state === 'listening'}
          aria-label={voice.state === 'listening' ? 'Stop listening and send' : 'Start voice conversation'}
        >
          <span aria-hidden="true">●</span> {voice.state === 'listening' ? 'Stop' : 'Talk'}
        </button>
        {voice.state === 'speaking' && <button type="button" onClick={voice.stopSpeaking}>Stop reply</button>}
        {voice.canSpeak && latest && voice.state !== 'speaking' && (
          <button type="button" onClick={voice.replay}>Replay</button>
        )}
        <p className="voice-status" role="status">{voice.state === 'listening' && voice.interim ? `“${voice.interim}”` : statusText[voice.state]}</p>
      </div>

      <form className="bubble-input" onSubmit={submit}>
        <label htmlFor={`ask-${person.id}`} className="sr-only">Ask {name}'s agent</label>
        <input
          id={`ask-${person.id}`}
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Ask ${name}'s agent…`}
          autoComplete="off"
          maxLength={1000}
        />
        <button type="submit" disabled={pending || !text.trim()}>Send</button>
      </form>

      {latest && (
        <button type="button" className="link sources-link" onClick={() => onOpenSources(latest)}>
          Sources and reasoning ({latest.sources.length}) →
        </button>
      )}
    </AnchoredBubble>
  );
}

// ---- Team answer: each consulted person speaks, then the angler gives the answer ----

interface TeamProps {
  scene: OceanScene | null;
  response: AskResponse;
  roster: PersonProfile[];
  caughtId: string | null;
  done: boolean;
  onOpenBrief: () => void;
  onCopy: (text: string) => void;
  onDismiss: () => void;
}

export function TeamBubbles({ scene, response, roster, caughtId, done, onOpenBrief, onCopy, onDismiss }: TeamProps) {
  const { brief } = response;
  const caught = caughtId ? roster.find((p) => p.id === caughtId) : undefined;
  const why = caughtId ? brief.relevantPeople.find((p) => p.personId === caughtId) : undefined;
  const owner = roster.find((p) => p.id === brief.ownerId);
  const ownerName = owner ? firstName(owner.name) : brief.ownerId;

  return (
    <>
      {caught && !done && (
        <AnchoredBubble scene={scene} anchorId={caught.id} width={300} className="bubble-catch" label={`${caught.name} was consulted`}>
          <span className="eyebrow">Consulted</span>
          <h3>{caught.name}</h3>
          <p>{why?.reason ?? caught.role}</p>
          {why && <p className="dim">{why.evidenceIds.length} source{why.evidenceIds.length === 1 ? '' : 's'} used</p>}
        </AnchoredBubble>
      )}
      {done && (
        <AnchoredBubble scene={scene} anchorId="boat" width={440} className="bubble-answer" label="Answer">
          <div className="bubble-head">
            <span className={`label label-${brief.trust.decision}`}>{labelText[brief.trust.decision]}</span>
            <button type="button" className="close" onClick={onDismiss} aria-label="Close answer">×</button>
          </div>
          <h2>{brief.status}</h2>
          <p>{brief.answer}</p>
          <p><strong>Next:</strong> {brief.nextStep}</p>
          {brief.downstreamBlockers.length > 0 && <p className="dim">Blocked: {brief.downstreamBlockers.join(' · ')}</p>}
          <div className="bubble-actions">
            <button type="button" className="primary" onClick={onOpenBrief}>Full brief and sources ({response.sources.length})</button>
            {brief.trust.requiresHuman && (
              <button type="button" onClick={() => onCopy(`Hi ${ownerName}, ${brief.nextStep}`)}>Copy request for {ownerName}</button>
            )}
          </div>
        </AnchoredBubble>
      )}
    </>
  );
}
