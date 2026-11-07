import { useMemo, useState, type FormEvent } from 'react';
import { askPerson, type AskResponse, type PersonProfile } from '../api';
import { labelHelp, labelText } from '../data';

interface Turn {
  question: string;
  response: AskResponse;
}

interface Props {
  initialResponse: AskResponse;
  person: PersonProfile;
  requesterId: string;
  onClose: () => void;
  onLatestResponse: (response: AskResponse) => void;
  onCopy: (text: string) => void;
}

export default function PersonConversation({
  initialResponse,
  person,
  requesterId,
  onClose,
  onLatestResponse,
  onCopy,
}: Props) {
  const [turns, setTurns] = useState<Turn[]>([{ question: initialResponse.question, response: initialResponse }]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = turns[turns.length - 1].response;
  const trust = latest.brief.trust;
  const sourceCount = useMemo(() => new Set(turns.flatMap((turn) => turn.response.sources.map((source) => source.id))).size, [turns]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextQuestion = question.trim();
    if (!nextQuestion || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await askPerson(person.id, nextQuestion, requesterId);
      setTurns((current) => [...current, { question: nextQuestion, response }]);
      setQuestion('');
      onLatestResponse(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The conversation could not continue.');
    } finally {
      setPending(false);
    }
  };

  const speak = () => {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(latest.brief.answer));
  };

  return (
    <section className="conversation" aria-labelledby="conversation-title">
      <header className="conversation-head">
        <div>
          <span className="eyebrow">Direct conversation</span>
          <h2 id="conversation-title">{person.name}</h2>
          <p>{person.role} · {person.availabilityLabel}</p>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Close conversation">×</button>
      </header>

      <div className="agent-boundary" role="note">
        <span className={`label label-${trust.decision}`}>{labelText[trust.decision]}</span>
        <p>This is {person.name}’s context agent, not {person.name}. It can explain known context, but it cannot approve or commit on their behalf.</p>
      </div>

      <div className="transcript" aria-live="polite">
        {turns.map((turn) => (
          <article className="turn" key={turn.response.requestId}>
            <div className="message message-you">
              <span>You</span>
              <p>{turn.question}</p>
            </div>
            <div className="message message-agent">
              <span>{person.name} · context agent</span>
              {turn.response.brief.answer.split('\n').map((line, index) => (
                <p key={index}>{line.startsWith('- ') ? `• ${line.slice(2)}` : line}</p>
              ))}
              <details>
                <summary>{turn.response.sources.length} source{turn.response.sources.length === 1 ? '' : 's'} used</summary>
                <ul>
                  {turn.response.sources.map((source) => (
                    <li key={source.id}>{source.title} <span>· {source.sourceLabel}{source.stale ? ' · out of date' : ''}</span></li>
                  ))}
                </ul>
              </details>
            </div>
          </article>
        ))}
        {pending && <p className="thinking">Checking {person.name}’s approved context…</p>}
      </div>

      <div className="conversation-tools">
        <p>{labelHelp[trust.decision]} · {sourceCount} unique source{sourceCount === 1 ? '' : 's'} in this conversation</p>
        <div>
          <button type="button" onClick={speak}>Read latest aloud</button>
          {trust.requiresHuman && (
            <button type="button" onClick={() => onCopy(`Hi ${person.name}, ${latest.brief.nextStep}`)}>Copy handoff note</button>
          )}
        </div>
      </div>

      <form className="follow-up" onSubmit={submit}>
        <label htmlFor="follow-up-input" className="sr-only">Ask a follow-up</label>
        <input
          id="follow-up-input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={`Ask ${person.name}’s context agent a follow-up…`}
          maxLength={1000}
          autoFocus
        />
        <button type="submit" disabled={pending || !question.trim()}>{pending ? 'Checking…' : 'Send'}</button>
      </form>
      {error && <p className="conversation-error" role="alert">{error}</p>}
    </section>
  );
}
