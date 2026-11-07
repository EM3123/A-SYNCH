// The Situation Brief: the centerpiece of the demo. It answers the five questions from the
// end-goal doc, all from the backend's answer and its cited sources:
//   1 What is this?  2 Where does it stand?  3 How did it get here?
//   4 Who owns it, and are they available?  5 What happens next?
// Words come from brief.* and sources[] only; this component never invents content.
import type { AskResponse, Evidence } from '../api';
import type { Agent } from "./types";

interface Props {
  response: AskResponse;
  agents: Record<string, Agent>;
  onTalk: (agentId: string) => void;
  onCopy: (text: string) => void;
}

const DECISION: Record<string, string> = {
  confirmed: 'Confirmed',
  supported: 'Supported',
  'needs-human': 'Needs a person',
};

const DECISION_HELP: Record<string, string> = {
  confirmed: 'Two or more fresh sources agree.',
  supported: 'Backed by current, cited evidence.',
  'needs-human': 'A person has to decide. The agent will not.',
};

const STEP: Record<string, string> = { done: 'Done', next: 'Next', blocked: 'Blocked' };

// How much weight a source carries. Predictions are shown, but labeled and never treated as fact.
function tierOf(e: Evidence): { label: string; tone: 'fact' | 'principle' | 'stated' | 'prediction' } {
  if (e.kind === 'prediction') return { label: 'Predicted. Sent to the owner for approval', tone: 'prediction' };
  if (e.kind === 'stated-principle') return e.ownerApproved ? { label: 'Owner-approved principle', tone: 'principle' } : { label: 'Stated reasoning', tone: 'stated' };
  return { label: 'Evidence', tone: 'fact' };
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export function EvidenceList({ ids, sources, agents }: { ids: string[]; sources: Evidence[]; agents: Record<string, Agent> }) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return (
    <ul className="bp-sources">
      {ids.map((id) => {
        const e = byId.get(id);
        if (!e) return <li key={id} className="bp-muted">A source you cannot open</li>;
        const tier = tierOf(e);
        return (
          <li key={id} className={e.stale ? 'bp-stale' : ''}>
            <span className={`bp-tier tier-${tier.tone}`}>{tier.label}</span>
            <strong>{e.title}</strong>
            <span className="bp-muted"> · {e.sourceLabel} · {agents[e.ownerId]?.name ?? e.ownerId} · {when(e.timestamp)}{e.stale ? ' · out of date' : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function BriefPanel({ response, agents, onTalk, onCopy }: Props) {
  const { brief, sources, securityEvents, meta } = response;
  const owner = agents[brief.ownerId];
  const ownerFirst = owner?.name.split(' ')[0] ?? brief.ownerId;
  const decision = brief.trust.decision;
  const claimIds = [...new Set(brief.claims.flatMap((c) => c.evidenceIds))];

  return (
    <article className="bp" aria-label="Situation brief">
      <header className="bp-head">
        <span className={`bp-label label-${decision}`} title={DECISION_HELP[decision]}>{DECISION[decision]}</span>
        <p className="bp-muted">{DECISION_HELP[decision]} · {sources.length} sources · {meta.usedFallback ? 'Seeded demo answer' : 'Live answer'}</p>
      </header>

      {/* 1. What is this? */}
      <section>
        <h3>1 · What is this?</h3>
        <h2 className="bp-title">{brief.title}</h2>
        <p className="bp-answer">{brief.answer}</p>
      </section>

      {/* 2. Where does it stand? */}
      <section>
        <h3>2 · Where does it stand?</h3>
        <p className="bp-status">{brief.status}</p>
        <ul className="bp-claims">
          {brief.claims.map((c, i) => (
            <li key={i}>
              <span className={`bp-chip trust-${c.trust}`}>{DECISION[c.trust]}</span> {c.text}
              <EvidenceList ids={c.evidenceIds} sources={sources} agents={agents} />
            </li>
          ))}
        </ul>
      </section>

      {/* 3. How did it get here? The decision path, then what disagrees. */}
      <section>
        <h3>3 · How did it get here?</h3>
        <ol className="bp-tree">
          {brief.decisionTree.map((n, i) => (
            <li key={i} className={`step-${n.state}`}>
              <span className="bp-step">{STEP[n.state]}</span>
              <strong>{n.label}</strong>
              <span className="bp-muted">{n.reason}</span>
            </li>
          ))}
        </ol>
        {brief.conflicts.length > 0 && (
          <div className="bp-conflict">
            <strong>Sources disagree (shown with dates, not resolved by guessing)</strong>
            <ul>{brief.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        )}
      </section>

      {/* 4. Who owns it, and are they available? */}
      <section>
        <h3>4 · Who owns it, and are they available?</h3>
        {owner && (
          <p>
            <strong>{owner.name}</strong> owns this. {owner.availabilityLabel}.{' '}
            {owner.availability === 'available'
              ? <span className="bp-ok">Free now. Go to them directly.</span>
              : <span className="bp-warn">Not reachable now. Ask their context agent.</span>}
          </p>
        )}
        <ul className="bp-people">
          {brief.relevantPeople.map((p) => {
            const a = agents[p.personId];
            const first = a?.name.split(' ')[0] ?? p.personId;
            return (
              <li key={p.personId}>
                <div>
                  <strong>{a?.name ?? p.personId}</strong>
                  <span className={`bp-avail av-${a?.availability ?? 'away'}`}>{a?.availabilityLabel ?? ''}</span>
                  <p className="bp-muted">{p.reason}</p>
                </div>
                <button type="button" onClick={() => onTalk(p.personId)}>Talk to {first}'s agent</button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 5. What happens next? */}
      <section>
        <h3>5 · What happens next?</h3>
        <p><strong>Next step:</strong> {brief.nextStep}</p>
        {brief.downstreamBlockers.length > 0 && (
          <>
            <p className="bp-muted">Blocked downstream</p>
            <ul>{brief.downstreamBlockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </>
        )}
        {brief.trust.requiresHuman && (
          <div className="bp-human" role="note">
            <strong>{ownerFirst} has to decide this.</strong> {brief.trust.reasons.join(' ')}
            <div><button type="button" onClick={() => onCopy(`Hi ${ownerFirst}, ${brief.nextStep}`)}>Copy request for {ownerFirst}</button></div>
          </div>
        )}
      </section>

      <section>
        <h3>Trust and security</h3>
        <ul className="bp-trust">
          <li>Every claim above links to its source with a timestamp: {claimIds.length} sources cited.</li>
          <li>This is an AI context agent. It never decides or commits on anyone's behalf.</li>
          {securityEvents.map((e, i) => <li key={i} className="bp-sec">{e.label}</li>)}
        </ul>
      </section>
    </article>
  );
}

