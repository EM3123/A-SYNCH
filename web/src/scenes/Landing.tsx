// Landing: the ocean is the interface. Ask the team and the angler casts; the lure sinks,
// each person the backend selected swims up and is reeled in. Ask one person and your fish
// swims to theirs. Hover a fish to meet them, click it to ask them directly.
// The answer itself is text on the page: label, claims, sources, conflicts, next steps.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { askPerson, askTeam, type AskResponse, type PersonProfile } from '../api';
import { OceanScene } from '../scene/OceanScene';
import ResultPanel from './ResultPanel';

export type Mode = 'team' | 'person';

// Prompts from the teammate's handoff doc. They are the guaranteed demo questions.
const DEMO_QUESTIONS = [
  'Can we ship Atlas today?',
  'Would Priya support a 10% beta rollout today?',
  'Approve the Atlas launch for me.',
];

// The requester is the demo user from the backend (lib/agents/demo-context.ts).
const REQUESTER_ID = 'daksh';

const HISTORY_KEY = 'asynch.history';

interface Props {
  roster: PersonProfile[];
  reduceMotion: boolean;
  motionOn: boolean;
  onToggleMotion: () => void;
  onEnter: () => void;
  onResponse: (r: AskResponse | null) => void;
}

function loadHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: string[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    // Storage can be blocked. History is a convenience, so the app keeps working.
  }
}

export default function Landing({ roster, reduceMotion, motionOn, onToggleMotion, onEnter, onResponse }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OceanScene | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('team');
  const [pickedId, setPersonId] = useState<string>('');
  // Default to the first teammate until someone picks a person.
  const personId = pickedId || roster[0]?.id || '';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [copied, setCopied] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);

  // The scene lives for the lifetime of the page.
  useEffect(() => {
    const scene = new OceanScene(canvasRef.current!, {
      onHover: setHovered,
      onPick: (id) => {
        // Clicking a fish means "ask this person".
        setMode('person');
        setPersonId(id);
        inputRef.current?.focus();
      },
    });
    sceneRef.current = scene;
    return () => scene.destroy();
  }, []);

  useEffect(() => { sceneRef.current?.setRoster(roster); }, [roster]);
  useEffect(() => { sceneRef.current?.setReduced(reduceMotion); }, [reduceMotion]);
  useEffect(() => { onResponse(response); }, [response, onResponse]);

  // "/" focuses the question, Escape clears the result.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && !typing) {
        setResponse(null);
        setError(null);
        setQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || pending) return;
    setPending(true);
    setError(null);
    setCopied('');
    if (mode === 'team') sceneRef.current?.search();
    try {
      const r = mode === 'team' ? await askTeam(q, REQUESTER_ID) : await askPerson(personId, q, REQUESTER_ID);
      setResponse(r);
      if (r.mode === 'person') sceneRef.current?.playPerson(r.selectedPeople[0]?.id ?? personId);
      else sceneRef.current?.playTeam(r.selectedPeople.map((p) => p.id));
      const h = [q, ...history.filter((x) => x !== q)].slice(0, 5);
      setHistory(h);
      saveHistory(h);
    } catch (err) {
      sceneRef.current?.playTeam([]);
      setResponse(null);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied.');
    } catch {
      setCopied('Copy did not work. Select the text and copy it by hand.');
    }
  };

  const hoveredPerson = hovered ? roster.find((p) => p.id === hovered) : undefined;

  return (
    <main className="landing">
      <canvas ref={canvasRef} className="ocean" aria-hidden="true" />

      <header className="chrome">
        <div className="brand">A-SYNCH <span className="dim">· team memory</span></div>
        <div className="chrome-right">
          <button type="button" aria-pressed={motionOn} onClick={onToggleMotion}>
            Motion {motionOn ? 'on' : 'off'}
          </button>
          <button type="button" onClick={onEnter}>Enter the reef →</button>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="serif">Cast a question.<br />Catch the person who knows.</h1>
        <p className="dim">Every fish is a teammate's context. Hover one to meet them, click to ask them.</p>
      </section>

      <div className="side">
      <form className="query" onSubmit={submit}>
        <label htmlFor="query-input" className="sr-only">Ask a question</label>
        <input
          id="query-input"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === 'team' ? 'Ask the team a question…' : `Ask ${roster.find((p) => p.id === personId)?.name ?? 'them'}…`}
          autoComplete="off"
          maxLength={1000}
          aria-describedby="query-help"
        />
        <p id="query-help" className="hint">Press / to focus, Escape to clear, Enter to ask.</p>

        <div className="row">
          <div className="modes" role="group" aria-label="Who to ask">
            <button type="button" aria-pressed={mode === 'team'} onClick={() => setMode('team')}>Ask the team</button>
            <button type="button" aria-pressed={mode === 'person'} onClick={() => setMode('person')}>Ask one person</button>
          </div>
          {mode === 'person' && (
            <label className="field">
              <span>Person</span>
              <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                {roster.map((p) => <option key={p.id} value={p.id}>{p.name}, {p.role}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="row examples" aria-label="Example questions">
          {DEMO_QUESTIONS.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => { setQuery(q); inputRef.current?.focus(); }}>{q}</button>
          ))}
        </div>

        {history.length > 0 && (
          <div className="row history" aria-label="Recent questions">
            <span className="dim">Recent</span>
            {history.map((h) => (
              <button key={h} type="button" className="chip" onClick={() => { setQuery(h); inputRef.current?.focus(); }}>{h}</button>
            ))}
          </div>
        )}

        <button type="submit" className="submit" disabled={pending || !query.trim()}>
          {pending ? 'Casting…' : 'Cast'}
        </button>
        {copied && <p role="status" className="dim">{copied}</p>}
      </form>

      {error && (
        <section className="answer" role="alert">
          <h2 className="serif">Couldn't get an answer</h2>
          <p>{error}</p>
        </section>
      )}

      {response && (
        <ResultPanel
          response={response}
          people={roster}
          onAskAgain={() => { setResponse(null); setQuery(''); inputRef.current?.focus(); }}
          onCopy={copy}
        />
      )}
      </div>

      <p className="sr-only" role="status">
        {pending
          ? 'Searching the team.'
          : response
            ? `${response.brief.trust.decision}. ${response.brief.answer.split('\n')[0]}`
            : error ?? (hoveredPerson ? `${hoveredPerson.name}, ${hoveredPerson.role}, ${hoveredPerson.availabilityLabel}` : '')}
      </p>
    </main>
  );
}
