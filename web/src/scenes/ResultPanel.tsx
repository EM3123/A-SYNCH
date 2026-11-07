// The answer, as text. Everything the AI "said" comes from brief.* fields; nothing is added here.
import type { AskResponse, Evidence, PersonProfile } from '../api';
import { labelText, labelHelp } from '../data';

interface Props {
  response: AskResponse;
  people: PersonProfile[];
  onAskAgain: () => void;
  onCopy: (text: string) => void;
}

const nameOf = (people: PersonProfile[], id: string) => people.find((p) => p.id === id)?.name ?? id;

export default function ResultPanel({ response, people, onAskAgain, onCopy }: Props) {
  const { brief, sources, securityEvents, meta, routingEvents } = response;
  const byId = new Map<string, Evidence>(sources.map((s) => [s.id, s]));
  const decision = brief.trust.decision;
  const owner = nameOf(people, brief.ownerId);

  return (
    <section className="answer" aria-labelledby="answer-title">
      <div className="answer-head">
        <span className={`label label-${decision}`} title={labelHelp[decision]}>{labelText[decision]}</span>
        <h2 id="answer-title" className="serif">{brief.title}</h2>
      </div>
      <p className="dim">{labelHelp[decision]} {meta.usedFallback ? '· Demo mode' : '· Live'} · {Math.round(meta.durationMs)} ms</p>

      <p className="status">{brief.status}</p>
      {brief.answer.split('\n').map((line, i) => (
        <p key={i} className={line.startsWith('- ') ? 'bullet' : 'body'}>{line.startsWith('- ') ? line.slice(2) : line}</p>
      ))}

      {brief.trust.requiresHuman && (
        <div className="callout" role="note">
          <strong>Needs {owner}.</strong> {brief.trust.reasons.join(' ')}
          <div className="row">
            <button type="button" onClick={() => onCopy(`Hi ${owner}, ${brief.nextStep}`)}>Copy a note for {owner}</button>
          </div>
        </div>
      )}

      {brief.claims.length > 0 && (
        <div>
          <h3>Claims</h3>
          <ul className="claims">
            {brief.claims.map((c, i) => (
              <li key={i}>
                <span className={`chip-trust trust-${c.trust}`}>{labelText[c.trust]}</span> {c.text}
                <ul className="sources">
                  {c.evidenceIds.map((id) => {
                    const ev = byId.get(id);
                    return ev ? (
                      <li key={id} className={ev.stale ? 'stale' : ''}>
                        {ev.title} <span className="dim">· {ev.sourceLabel} · {nameOf(people, ev.ownerId)}{ev.stale ? ' · out of date' : ''}</span>
                      </li>
                    ) : (
                      <li key={id} className="dim">Source not available to you</li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.conflicts.length > 0 && (
        <div>
          <h3>Sources disagree</h3>
          <ul>{brief.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}

      {brief.decisionTree.length > 0 && (
        <div>
          <h3>Next steps</h3>
          <ol className="tree">
            {brief.decisionTree.map((n, i) => (
              <li key={i} className={`state-${n.state}`}>
                <span className="dim">{n.state === 'done' ? 'Done' : n.state === 'next' ? 'Next' : 'Blocked'}</span> {n.label}
                <span className="dim"> · {n.reason}</span>
              </li>
            ))}
          </ol>
          <p><strong>Next step:</strong> {brief.nextStep}</p>
        </div>
      )}

      {brief.downstreamBlockers.length > 0 && (
        <div>
          <h3>Blocked by</h3>
          <ul>{brief.downstreamBlockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      )}

      {brief.relevantPeople.length > 0 && (
        <div>
          <h3>People</h3>
          <ul>
            {brief.relevantPeople.map((p) => (
              <li key={p.personId}>{nameOf(people, p.personId)} <span className="dim">· {p.reason}</span></li>
            ))}
          </ul>
        </div>
      )}

      {securityEvents.length > 0 && (
        <div>
          <h3>Security checks</h3>
          <ul>{securityEvents.map((e, i) => <li key={i}>{e.label}</li>)}</ul>
        </div>
      )}

      <details>
        <summary>How this was routed ({routingEvents.length} steps)</summary>
        <ol>{routingEvents.map((e, i) => <li key={i}>{e.label}</li>)}</ol>
      </details>

      <button type="button" className="again" onClick={onAskAgain}>Ask another</button>
    </section>
  );
}
