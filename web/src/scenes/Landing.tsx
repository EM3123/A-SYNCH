// Landing: the ocean is the interface, and every fish is a teammate's context agent.
// - Ask the team: the angler casts, each person the backend consulted is reeled up and says
//   why they were consulted, then the angler gives the answer in a bubble.
// - Talk to one person: click their fish (or pick them in the list). It swims up to you and
//   you talk by voice or text in its bubble.
// The full brief and every source open in a drawer from the bubble.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { askTeam, type AskResponse, type PersonProfile } from '../api';
import { OceanScene } from '../scene/OceanScene';
import ResultPanel from './ResultPanel';
import { FishTalk, TeamBubbles } from './Bubbles';

// The guaranteed demo questions. Person questions open that person's agent directly.
const DEMO_QUESTIONS: Array<{ text: string; personId?: string }> = [
  { text: 'Can we ship Atlas today?' },
  { text: 'Would Priya support a 10% beta rollout today?', personId: 'priya' },
  { text: 'Approve the Atlas launch for me.', personId: 'priya' },
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [scene, setScene] = useState<OceanScene | null>(null);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<AskResponse | null>(null);
  const [caughtId, setCaughtId] = useState<string | null>(null);
  const [castDone, setCastDone] = useState(false);
  const [talk, setTalk] = useState<{ id: string; first?: string } | null>(null);
  const [drawer, setDrawer] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);

  // One scene for the lifetime of the page.
  useEffect(() => {
    const s = new OceanScene(canvasRef.current!, {
      onHover: setHovered,
      onPick: (id) => setTalk({ id }),
      onCaught: (id) => setCaughtId(id),
      onCastDone: () => { setCaughtId(null); setCastDone(true); },
    });
    const frame = window.requestAnimationFrame(() => setScene(s));
    return () => {
      window.cancelAnimationFrame(frame);
      s.destroy();
    };
  }, []);

  // History is read after mount so the server render (Next.js) matches the first client render.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHistory(loadHistory()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => { scene?.setRoster(roster); }, [scene, roster]);
  useEffect(() => { scene?.setReduced(reduceMotion); }, [scene, reduceMotion]);

  // "/" focuses the question, Escape closes whatever is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (drawer) setDrawer(null);
        else if (talk) setTalk(null);
        else if (team) setTeam(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, talk, team]);

  const shareResponse = useCallback((r: AskResponse) => onResponse(r), [onResponse]);

  const askTheTeam = async (q: string) => {
    if (!q || pending) return;
    setTalk(null);
    setPending(true);
    setError(null);
    setCopied('');
    setTeam(null);
    setCaughtId(null);
    setCastDone(false);
    scene?.search();
    try {
      const r = await askTeam(q, REQUESTER_ID);
      setTeam(r);
      onResponse(r);
      scene?.playTeam(r.selectedPeople.map((p) => p.id));
      const h = [q, ...history.filter((x) => x !== q)].slice(0, 5);
      setHistory(h);
      saveHistory(h);
    } catch (err) {
      scene?.playTeam([]);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void askTheTeam(query.trim());
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied to clipboard.');
    } catch {
      setCopied('Copy did not work. Select the text and copy it by hand.');
    }
  };

  const talkPerson = talk ? roster.find((p) => p.id === talk.id) : undefined;
  const hoveredPerson = hovered ? roster.find((p) => p.id === hovered) : undefined;

  return (
    <main className="landing">
      <canvas ref={canvasRef} className="ocean" aria-hidden="true" />

      <header className="chrome">
        <div className="brand">A-SYNCH <span>/ SEEDED DEMO</span></div>
        <div className="chrome-right">
          <button type="button" aria-pressed={motionOn} onClick={onToggleMotion}>
            Motion {motionOn ? 'on' : 'off'}
          </button>
          <button type="button" onClick={onEnter}>Enter the reef →</button>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="serif">Cast a question.<br />Catch who knows.</h1>
        <p className="dim">Each fish is a teammate's context agent. Click one to talk to it.</p>
      </section>

      <div className="side">
        <form className="query" onSubmit={submit}>
          <span className="eyebrow">Ask the team</span>
          <label htmlFor="query-input" className="sr-only">Ask the team a question</label>
          <input
            id="query-input"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask your team anything…"
            autoComplete="off"
            maxLength={1000}
            aria-describedby="query-help"
          />
          <p id="query-help" className="hint">Press / to focus · Enter to cast · Escape to close</p>
          <button type="submit" className="submit" disabled={pending || !query.trim()}>
            {pending ? 'Casting…' : 'Cast'}
          </button>

          <div className="examples" aria-label="Example questions">
            {DEMO_QUESTIONS.map((demo) => (
              <button
                key={demo.text}
                type="button"
                className="chip"
                onClick={() => {
                  if (demo.personId) {
                    setTeam(null);
                    setTalk({ id: demo.personId, first: demo.text });
                  } else {
                    setQuery(demo.text);
                    void askTheTeam(demo.text);
                  }
                }}
              >
                {demo.text}
              </button>
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
          {copied && <p role="status" className="dim">{copied}</p>}
        </form>

        {/* Keyboard and screen-reader way into each fish. */}
        <section className="people" aria-labelledby="people-title">
          <h2 id="people-title" className="eyebrow">Talk to someone's agent</h2>
          <ul>
            {roster.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={talk?.id === p.id}
                  onClick={() => { setTeam(null); setTalk({ id: p.id }); }}
                >
                  <span className="dot" style={{ background: p.accent }} aria-hidden="true" />
                  <span className="who">{p.name}</span>
                  <span className="dim">{p.availabilityLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {error && (
          <section className="answer" role="alert">
            <h2 className="serif">Couldn't get an answer</h2>
            <p>{error}</p>
          </section>
        )}
      </div>

      {team && (
        <TeamBubbles
          scene={scene}
          response={team}
          roster={roster}
          caughtId={caughtId}
          done={castDone}
          onOpenBrief={() => setDrawer(team)}
          onCopy={copy}
          onDismiss={() => setTeam(null)}
        />
      )}

      {talkPerson && (
        <FishTalk
          key={talkPerson.id + (talk?.first ?? '')}
          scene={scene}
          person={talkPerson}
          requesterId={REQUESTER_ID}
          firstQuestion={talk?.first}
          onClose={() => setTalk(null)}
          onResponse={shareResponse}
          onOpenSources={(r) => setDrawer(r)}
          onCopy={copy}
        />
      )}

      {drawer && (
        <aside className="drawer brief-drawer" aria-labelledby="answer-title">
          <button type="button" className="close" onClick={() => setDrawer(null)} aria-label="Close brief">×</button>
          <ResultPanel
            response={drawer}
            people={roster}
            onAskAgain={() => { setDrawer(null); inputRef.current?.focus(); }}
            onCopy={copy}
          />
        </aside>
      )}

      <p className="sr-only" role="status">
        {pending
          ? 'Casting. Searching the team.'
          : castDone && team
            ? `${team.brief.trust.decision}. ${team.brief.answer}`
            : error ?? (hoveredPerson ? `${hoveredPerson.name}, ${hoveredPerson.role}, ${hoveredPerson.availabilityLabel}. Click to talk.` : '')}
      </p>
    </main>
  );
}
