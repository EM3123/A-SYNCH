import type { AskResponse, Evidence, PersonProfile } from '../api';
import { labelText } from '../data';

interface Props {
  response: AskResponse;
  people: PersonProfile[];
  onAskAgain: () => void;
  onCopy: (text: string) => void;
  onTalkToPerson: (personId: string) => void;
}

const nameOf = (people: PersonProfile[], id: string) => people.find((person) => person.id === id)?.name ?? id;

function sourceDate(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ResultPanel({ response, people, onAskAgain, onCopy, onTalkToPerson }: Props) {
  const { brief, sources, securityEvents, meta, routingEvents } = response;
  const byId = new Map<string, Evidence>(sources.map((source) => [source.id, source]));
  const owner = nameOf(people, brief.ownerId);
  const perspectivePerson = people.find((person) => person.id === 'priya') ?? people.find((person) => person.id === brief.ownerId);
  const citedIds = new Set(brief.claims.flatMap((claim) => claim.evidenceIds));
  const citedSources = sources.filter((source) => citedIds.has(source.id));

  return (
    <section className="situation-brief" aria-labelledby="brief-title">
      <div className="brief-topline">
        <div className="brief-status-group">
          <span className={`trust-badge trust-badge-${brief.trust.decision}`}>
            <i /> {labelText[brief.trust.decision]}
          </span>
          <span className="brief-runtime">
            {meta.usedFallback ? 'Verified local fallback' : `Live synthesis${meta.model ? ` · ${meta.model.split('/').pop()}` : ''}`}
          </span>
        </div>
        <span className="brief-time">Built in {(meta.durationMs / 1000).toFixed(1)}s</span>
      </div>

      <div className="brief-verdict">
        <span>Situation Brief</span>
        <h2 id="brief-title">{brief.title}</h2>
        <p>{brief.answer}</p>
      </div>

      <div className="brief-action">
        <div>
          <span>Best next move</span>
          <strong>{brief.nextStep}</strong>
        </div>
        <div className="brief-owner">
          <span>Current owner</span>
          <strong>{owner}</strong>
        </div>
      </div>

      {brief.decisionTree.length > 0 && (
        <div className="decision-path" aria-label="Decision path">
          {brief.decisionTree.map((node, index) => (
            <article key={`${node.label}-${index}`} data-state={node.state}>
              <div><i /> <span>{node.state === 'done' ? 'Verified' : node.state === 'next' ? 'Next' : 'Blocked'}</span></div>
              <strong>{node.label}</strong>
              <p>{node.reason}</p>
            </article>
          ))}
        </div>
      )}

      <div className="brief-actions">
        {perspectivePerson && (
          <button type="button" className="primary-action" onClick={() => onTalkToPerson(perspectivePerson.id)}>
            Talk it through with {perspectivePerson.name.split(' ')[0]} <span>→</span>
          </button>
        )}
        <button type="button" onClick={() => onCopy(`Corvid Labs Situation Brief: ${brief.answer}\n\nNext: ${brief.nextStep}`)}>
          Copy brief
        </button>
        <button type="button" onClick={onAskAgain}>Ask another</button>
      </div>

      <details className="proof-drawer">
        <summary>
          <span><i /> Evidence &amp; safety</span>
          <small>{citedSources.length} cited records · {securityEvents.length || 1} guardrail check{securityEvents.length === 1 ? '' : 's'}</small>
        </summary>
        <div className="proof-content">
          <div className="proof-claims">
            <span className="proof-heading">Verified claims</span>
            {brief.claims.map((claim, index) => (
              <article key={`${claim.text}-${index}`}>
                <div>
                  <span className={`mini-trust mini-trust-${claim.trust}`}>{labelText[claim.trust]}</span>
                  <p>{claim.text}</p>
                </div>
                <ul>
                  {claim.evidenceIds.map((id) => {
                    const source = byId.get(id);
                    return source ? (
                      <li key={id} className={source.stale ? 'source-stale' : ''}>
                        <strong>{source.title}</strong>
                        <span>{source.sourceLabel} · {sourceDate(source.timestamp)}{source.stale ? ' · stale' : ''}</span>
                      </li>
                    ) : <li key={id}><span>Source unavailable at your permission level</span></li>;
                  })}
                </ul>
              </article>
            ))}
          </div>

          <aside className="proof-side">
            <div>
              <span className="proof-heading">Why you can trust this</span>
              <p>The model proposed a brief. Deterministic checks verified provenance, permissions, freshness, and authority before you saw it.</p>
            </div>
            {brief.conflicts.length > 0 && (
              <div>
                <span className="proof-heading">Conflicts surfaced</span>
                {brief.conflicts.map((conflict) => <p key={conflict}>{conflict}</p>)}
              </div>
            )}
            {securityEvents.length > 0 && (
              <div>
                <span className="proof-heading">Guardrails triggered</span>
                {securityEvents.map((event, index) => <p key={`${event.label}-${index}`}>{event.label}</p>)}
              </div>
            )}
            <details>
              <summary>Agent trace · {routingEvents.length} steps</summary>
              <ol>{routingEvents.map((event, index) => <li key={`${event.label}-${index}`}>{event.label}</li>)}</ol>
            </details>
          </aside>
        </div>
      </details>
    </section>
  );
}
