import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { askTeam, type AskResponse, type PersonProfile } from '../api';
import PerspectiveVoiceAgent from '../part-b/PerspectiveVoiceAgent';
import ResultPanel from './ResultPanel';

export type Mode = 'team' | 'person';

export interface Props {
  roster: PersonProfile[];
  reduceMotion?: boolean;
  motionOn?: boolean;
  onToggleMotion?: () => void;
  onEnter?: () => void;
  onResponse?: (response: AskResponse | null) => void;
}

const REQUESTER_ID = 'daksh';
const DEMO_IDS = ['priya', 'alex', 'sam', 'jordan', 'maya'] as const;
const ROOMS: Record<(typeof DEMO_IDS)[number], string> = {
  priya: 'Executive meeting',
  alex: 'Backend pod',
  sam: 'Frontend pod',
  jordan: 'Security review',
  maya: 'Customer hub',
};

const FALLBACK_PEOPLE: PersonProfile[] = [
  { id: 'priya', name: 'Priya Shah', role: 'Product & Engineering Lead', availability: 'busy', availabilityLabel: 'Executive meeting until 4:30 PM', expertise: ['Launch strategy', 'Product tradeoffs'], topics: ['atlas', 'beta', 'approval'], accent: '#5cc8ff' },
  { id: 'alex', name: 'Alex Chen', role: 'Senior Backend Engineer', availability: 'available', availabilityLabel: 'Available now', expertise: ['API reliability', 'Rollback'], topics: ['atlas', 'backend'], accent: '#77e0ad' },
  { id: 'sam', name: 'Sam Rivera', role: 'Senior Frontend Engineer', availability: 'available', availabilityLabel: 'Available now', expertise: ['Rollout controls', 'Accessibility'], topics: ['atlas', 'frontend'], accent: '#ffc96b' },
  { id: 'jordan', name: 'Jordan Lee', role: 'Security Engineer', availability: 'busy', availabilityLabel: 'Reviewing ATLAS-38', expertise: ['Security review', 'SSO'], topics: ['atlas', 'security'], accent: '#ff8f91' },
  { id: 'maya', name: 'Maya Patel', role: 'Customer Lead', availability: 'available', availabilityLabel: 'Available now', expertise: ['Design partners', 'Customer learning'], topics: ['atlas', 'customers'], accent: '#b89cff' },
];

const TEAM_QUESTIONS = [
  'Can we ship Atlas today?',
  'Who knows why general availability is blocked?',
  'Which design partners are waiting?',
];

const ROUTING_STAGES = [
  'Routing to the people who know',
  'Gathering approved evidence',
  'Checking permissions and trust',
  'Assembling the Situation Brief',
];

const sourceNames = ['GitHub', 'Jira', 'Slack', 'Meetings', 'Notes'];

export default function Landing({
  roster,
  reduceMotion = false,
  motionOn = true,
  onToggleMotion,
  onResponse,
}: Props) {
  const [mode, setMode] = useState<Mode>('team');
  const [selectedId, setSelectedId] = useState('priya');
  const [question, setQuestion] = useState('Can we ship Atlas today?');
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [demoUrl, setDemoUrl] = useState('');

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDemoUrl(window.location.origin));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const people = useMemo(() => DEMO_IDS.map((id) => (
    roster.find((person) => person.id === id)
      ?? FALLBACK_PEOPLE.find((person) => person.id === id)!
  )), [roster]);
  const selectedPerson = people.find((person) => person.id === selectedId) ?? people[0];
  const consulted = new Set(response?.selectedPeople.map((person) => person.id) ?? []);

  const openPerson = (personId: string) => {
    setSelectedId(personId);
    setMode('person');
  };

  const ask = async (nextQuestion = question) => {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion || loading) return;
    setQuestion(cleanQuestion);
    setLoading(true);
    setResponse(null);
    onResponse?.(null);
    setError(null);
    setStage(0);

    const intervalMs = reduceMotion ? 0 : 360;
    const timers = ROUTING_STAGES.slice(1).map((_, index) => window.setTimeout(
      () => setStage(index + 1),
      intervalMs * (index + 1),
    ));

    try {
      const [result] = await Promise.all([
        askTeam(cleanQuestion, REQUESTER_ID),
        new Promise((resolve) => window.setTimeout(resolve, reduceMotion ? 0 : 1500)),
      ]);
      setStage(ROUTING_STAGES.length);
      setResponse(result);
      onResponse?.(result);
    } catch (cause) {
      setStage(-1);
      setError(cause instanceof Error ? cause.message : 'The Situation Brief could not be assembled.');
    } finally {
      timers.forEach((timer) => window.clearTimeout(timer));
      setLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask();
  };

  const copyText = (text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  if (mode === 'person') {
    return (
      <PerspectiveVoiceAgent
        person={selectedPerson}
        requesterId={REQUESTER_ID}
        onClose={() => setMode('team')}
      />
    );
  }

  return (
    <main className="demo-shell">
      <header className="demo-header">
        <div>
          <span className="demo-brand">A-SYNCH</span>
          <span className="demo-product">Team intelligence, without the interruption</span>
        </div>
        <nav aria-label="Demo modes">
          <button type="button" aria-pressed="true">Ask the team</button>
          <button type="button" onClick={() => openPerson('priya')}>Talk to Priya's context agent</button>
          {onToggleMotion && (
            <button type="button" aria-pressed={motionOn} onClick={onToggleMotion}>
              Motion {motionOn ? 'on' : 'off'}
            </button>
          )}
        </nav>
        {demoUrl && (
          <div className="demo-qr" aria-label={`QR code for ${demoUrl}`}>
            <QRCodeSVG value={demoUrl} size={42} bgColor="#f6f8fb" fgColor="#07111c" level="M" marginSize={1} />
            <span><strong>Scan to try</strong><small>{demoUrl.replace(/^https?:\/\//, '')}</small></span>
          </div>
        )}
      </header>

      <div className="demo-grid">
        <section className="mesh-panel" aria-labelledby="mesh-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Corvid Labs · Project Atlas</span>
              <h1 id="mesh-title">Team Intelligence Mesh</h1>
            </div>
            <span className="seeded-label">Seeded demo workspace</span>
          </div>

          <div className="active-situation">
            <span>Active situation</span>
            <strong>Atlas launch readiness</strong>
            <small>5 owners · 22 relevant records · updated today</small>
          </div>

          <div className="mesh-list">
            {people.map((person) => (
              <button
                type="button"
                key={person.id}
                className={`mesh-person ${consulted.has(person.id) ? 'mesh-person-active' : ''}`}
                onClick={() => openPerson(person.id)}
              >
                <span className="person-avatar" style={{ borderColor: person.accent }}>{person.name.split(' ').map((part) => part[0]).join('')}</span>
                <span className="person-copy">
                  <strong>{person.name}</strong>
                  <small>{person.role}</small>
                  <em>{ROOMS[person.id as keyof typeof ROOMS]} · {person.availabilityLabel}</em>
                  <span>{person.expertise.slice(0, 2).join(' · ')}</span>
                </span>
                <span className={`availability availability-${person.availability}`}>{person.availability}</span>
              </button>
            ))}
          </div>

          <div className="source-strip" aria-label="Seeded data sources">
            {sourceNames.map((name) => <span key={name}>{name}</span>)}
          </div>
          <p className="mesh-note">Select any teammate when you already know whose stated perspective you need.</p>
        </section>

        <section className="brief-panel" aria-labelledby="ask-title">
          <div className="ask-block">
            <span className="eyebrow">Part A · organizational context</span>
            <h2 id="ask-title">Ask your team anything</h2>
            <p>We route to the people who know, verify their evidence, and return one defensible next step.</p>
            <form onSubmit={submit}>
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                aria-label="Question for the team"
                placeholder="What do you need to know?"
              />
              <button type="submit" disabled={loading || !question.trim()}>{loading ? 'Working…' : 'Build Situation Brief'}</button>
            </form>
            <div className="demo-prompts">
              {TEAM_QUESTIONS.map((prompt) => (
                <button type="button" key={prompt} onClick={() => void ask(prompt)} disabled={loading}>{prompt}</button>
              ))}
            </div>
          </div>

          {(loading || stage >= 0) && (
            <ol className="routing-progress" aria-label="Agent workflow" aria-live="polite">
              {ROUTING_STAGES.map((label, index) => (
                <li key={label} data-state={stage > index ? 'done' : stage === index ? 'active' : 'pending'}>
                  <span>{stage > index ? '✓' : index + 1}</span>{label}
                </li>
              ))}
            </ol>
          )}

          {error && <p className="demo-error" role="alert">{error}</p>}

          {response ? (
            <ResultPanel
              response={response}
              people={roster.length ? roster : people}
              onCopy={copyText}
              onAskAgain={() => {
                setResponse(null);
                onResponse?.(null);
                setStage(-1);
              }}
            />
          ) : !loading && (
            <div className="demo-empty">
              <strong>Demo path</strong>
              <span>Ask whether Atlas can ship, inspect the evidence-backed decision path, then open Priya for the judgment conversation.</span>
              <button type="button" onClick={() => openPerson('priya')}>Start voice conversation with Priya's context agent</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
