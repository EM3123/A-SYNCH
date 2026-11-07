import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { askTeam, type AskResponse, type PersonProfile } from '../api';
import PerspectiveVoiceAgent from '../part-b/PerspectiveVoiceAgent';
import ResultPanel from './ResultPanel';

type Mode = 'team' | 'person';

interface Props {
  roster: PersonProfile[];
  rosterError?: string | null;
}

const REQUESTER_ID = 'daksh';
const CORE_IDS = ['priya', 'alex', 'sam', 'jordan', 'maya'];
const TEAM_QUESTIONS = [
  'Can Corvid Labs ship the beta today?',
  'Why is general availability blocked?',
];
const ROUTING_STAGES = [
  'Finding who knows this',
  'Reading approved Corvid context',
  'Verifying every claim',
  'Building your brief',
];

const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2);

export default function Landing({ roster, rosterError }: Props) {
  const [mode, setMode] = useState<Mode>('team');
  const [selectedId, setSelectedId] = useState('priya');
  const [question, setQuestion] = useState('Can Corvid Labs ship the beta today?');
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [mode]);

  const selectedPerson = roster.find((person) => person.id === selectedId);
  const consulted = useMemo(
    () => new Set(response?.selectedPeople.map((person) => person.id) ?? []),
    [response],
  );
  const visiblePeople = useMemo(() => {
    const preferred = CORE_IDS
      .map((id) => roster.find((person) => person.id === id))
      .filter((person): person is PersonProfile => Boolean(person));
    return preferred.length ? preferred : roster.slice(0, 5);
  }, [roster]);

  const openPerson = (personId = 'priya') => {
    setSelectedId(personId);
    setMode('person');
  };

  const ask = async (nextQuestion = question) => {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion || loading) return;
    setQuestion(cleanQuestion);
    setLoading(true);
    setResponse(null);
    setError(null);
    setStage(0);

    const timers = ROUTING_STAGES.slice(1).map((_, index) => window.setTimeout(
      () => setStage(index + 1),
      430 * (index + 1),
    ));
    try {
      const [result] = await Promise.all([
        askTeam(cleanQuestion, REQUESTER_ID),
        new Promise((resolve) => window.setTimeout(resolve, 1_250)),
      ]);
      setResponse(result);
      setStage(ROUTING_STAGES.length - 1);
    } catch (cause) {
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

  if (mode === 'person') {
    if (!selectedPerson) {
      return (
        <main className="workspace-loading">
          <span className="brand-mark"><i /> A-SYNCH</span>
          <h1>Opening the Corvid Labs workspace…</h1>
          <button type="button" onClick={() => setMode('team')}>Back to team search</button>
        </main>
      );
    }
    return (
      <PerspectiveVoiceAgent
        person={selectedPerson}
        requesterId={REQUESTER_ID}
        onClose={() => setMode('team')}
      />
    );
  }

  return (
    <main className={`workspace-shell ${response ? 'workspace-has-result' : ''}`}>
      <header className="workspace-bar">
        <div className="workspace-brand">
          <span className="brand-mark"><i /> A-SYNCH</span>
          <span className="workspace-divider" />
          <span className="workspace-name">Corvid Labs</span>
          <span className="workspace-status"><i /> {roster.length || '—'} teammates connected</span>
        </div>
        <nav className="mode-switch" aria-label="Choose A-SYNCH mode">
          <button type="button" aria-current="page">Ask the team</button>
          <button type="button" onClick={() => openPerson('priya')} disabled={!roster.length}>
            Talk to a person <span>→</span>
          </button>
        </nav>
      </header>

      <section className="workspace-content">
        <div className="ask-hero">
          <div className="hero-copy">
            <span className="hero-eyebrow">CORVID LABS · TEAM INTELLIGENCE</span>
            <h1>Ask once.<br /><em>Keep work moving.</em></h1>
            <p>One answer assembled from the people, decisions, and work that already hold the context.</p>
          </div>

          <form className="ask-composer" onSubmit={submit}>
            <label htmlFor="team-question">What do you need to know?</label>
            <div>
              <input
                id="team-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask Corvid Labs anything…"
                autoComplete="off"
              />
              <button type="submit" disabled={loading || !question.trim()} aria-label="Build Situation Brief">
                {loading ? <span className="button-spinner" /> : <span aria-hidden="true">↗</span>}
              </button>
            </div>
            <div className="prompt-row">
              <span>Try</span>
              {TEAM_QUESTIONS.map((prompt) => (
                <button type="button" key={prompt} onClick={() => void ask(prompt)} disabled={loading}>
                  {prompt}
                </button>
              ))}
            </div>
          </form>
        </div>

        <div className="context-strip">
          <div className="context-label">
            <span>{response ? 'Context consulted' : 'Launch context'}</span>
            <small>Select someone to start with their perspective.</small>
          </div>
          <div className="people-row" aria-label="Corvid Labs launch team">
            {visiblePeople.map((person) => (
              <button
                type="button"
                key={person.id}
                className={consulted.has(person.id) ? 'person-pill person-pill-active' : 'person-pill'}
                onClick={() => openPerson(person.id)}
                title={`Talk to ${person.name}'s context agent`}
              >
                <span className="person-initials" style={{ '--person-accent': person.accent } as CSSProperties}>{initials(person.name)}</span>
                <span>
                  <strong>{person.name.split(' ')[0]}</strong>
                  <small>{person.expertise[0]}</small>
                </span>
                <i className={`presence presence-${person.availability}`} aria-label={person.availability} />
              </button>
            ))}
            {!visiblePeople.length && <span className="people-loading">Loading the Corvid Labs knowledge graph…</span>}
          </div>
        </div>

        {rosterError && <p className="workspace-error" role="alert">{rosterError}</p>}
        {error && <p className="workspace-error" role="alert">{error}</p>}

        {loading && (
          <div className="routing-line" role="status" aria-live="polite">
            <span className="routing-orbit"><i /><i /><i /></span>
            <div>
              <strong>{ROUTING_STAGES[stage]}</strong>
              <small>{stage + 1} of {ROUTING_STAGES.length} · The model proposes; the Trust Layer verifies.</small>
            </div>
          </div>
        )}

        {response ? (
          <ResultPanel
            response={response}
            people={roster}
            onAskAgain={() => setResponse(null)}
            onCopy={(text) => void navigator.clipboard?.writeText(text).catch(() => undefined)}
            onTalkToPerson={openPerson}
          />
        ) : !loading && (
          <div className="trust-strip" aria-label="A-SYNCH trust guarantees">
            <span><i>01</i><strong>Routes across real Corvid context</strong></span>
            <span><i>02</i><strong>Cites every material claim</strong></span>
            <span><i>03</i><strong>Never invents human authority</strong></span>
          </div>
        )}
      </section>
    </main>
  );
}
