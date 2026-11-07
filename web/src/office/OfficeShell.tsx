// OfficeOS shell: enterprise chrome around the office map.
// Layout: top bar · left sidebar · office map · activity feed · workforce bar with commands.
// The map is drawn by an OfficeRenderer (placeholder by default; pass your pixel-art one).
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createOfficeController, type OfficeController } from './controller';
import { PlaceholderRenderer, type OfficeRenderer } from './renderer';
import { useOffice } from './useOffice';
import { relationshipEdges, workforce } from './store';
import { STATUS_LABEL, type ActivityEvent } from './types';
import { useVoice } from '../voice/useVoice';
import './office.css';

const REQUESTER_ID = 'daksh'; // demo requester from the backend

const EXAMPLES = [
  'Can we ship Atlas today?',
  'Ask Priya would she support a 10% beta rollout today?',
  'Show me all agents waiting for input',
];

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function OfficeShell({ makeRenderer }: { makeRenderer?: () => OfficeRenderer }) {
  const [controller, setController] = useState<OfficeController | null>(null);
  const s = useOffice(controller);
  const mapRef = useRef<HTMLDivElement>(null);
  const [command, setCommand] = useState('');
  const [chatWith, setChatWith] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');

  // Controller lives for the page. Created after mount so server rendering stays clean.
  useEffect(() => {
    const c = createOfficeController(REQUESTER_ID);
    const frame = window.requestAnimationFrame(() => setController(c));
    void c.load();
    return () => { window.cancelAnimationFrame(frame); c.destroy(); };
  }, []);

  // Mount the renderer and keep it fed with state and events.
  useEffect(() => {
    if (!controller || !mapRef.current) return;
    const r = (makeRenderer ?? (() => new PlaceholderRenderer()))();
    r.mount(mapRef.current, {
      selectAgent: (id) => controller.select({ kind: 'agent', id }),
      selectRoom: (id) => controller.select({ kind: 'room', id }),
      hoverAgent: () => {},
      dropTask: (id, title) => void controller.assignTask(id, title),
    });
    r.render(controller.store.getState());
    const offState = controller.store.subscribe(() => r.render(controller.store.getState()));
    const offEvents = controller.store.onEvent((e) => r.event(e));
    return () => { offState(); offEvents(); r.destroy(); };
  }, [controller, makeRenderer]);

  const w = workforce(s);
  const sel = s.selection;
  const agent = sel?.kind === 'agent' ? s.agents[sel.id] : undefined;
  const room = sel?.kind === 'room' ? s.rooms[sel.id as keyof typeof s.rooms] : undefined;
  const meeting = sel?.kind === 'meeting' ? s.meetings[sel.id] : undefined;
  const edges = useMemo(() => relationshipEdges(s), [s]);

  const submitCommand = (e: FormEvent) => {
    e.preventDefault();
    const t = command.trim();
    if (!t || !controller) return;
    setCommand('');
    void controller.command(t);
  };

  const openFeed = (ev: ActivityEvent) => {
    if (!controller) return;
    if (ev.meetingId) controller.select({ kind: 'meeting', id: ev.meetingId });
    else if (ev.agentIds[0]) controller.select({ kind: 'agent', id: ev.agentIds[0] });
    else if (ev.room) controller.select({ kind: 'room', id: ev.room });
  };

  return (
    <div className="os">
      <header className="os-top">
        <div className="os-brand">A-SYNCH <span>/ OFFICE</span></div>
        <div className="os-workspace">Workspace: <strong>Project Atlas</strong> <span className="os-tag">Seeded demo</span></div>
        <div className="os-top-right">
          <button
            type="button"
            aria-pressed={s.mode === 'simplified'}
            onClick={() => controller?.setMode(s.mode === 'animated' ? 'simplified' : 'animated')}
          >
            {s.mode === 'animated' ? 'Animated' : 'Simplified'}
          </button>
        </div>
      </header>

      <nav className="os-side" aria-label="Agents">
        <h2>Agents</h2>
        <ul>
          {Object.values(s.agents).map((a) => (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={sel?.kind === 'agent' && sel.id === a.id}
                onClick={() => controller?.select({ kind: 'agent', id: a.id })}
              >
                <span className="os-dot" style={{ background: a.accent }} aria-hidden="true" />
                <span className="os-who">{a.name}</span>
                <span className={`os-status st-${a.status}`}>{STATUS_LABEL[a.status]}</span>
              </button>
            </li>
          ))}
        </ul>
        <h2>Meetings</h2>
        <ul>
          {Object.values(s.meetings).filter((m) => m.status !== 'ended').map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => controller?.select({ kind: 'meeting', id: m.id })}>
                <span className="os-who">{m.title}</span>
                <span className={`os-status mt-${m.status}`}>{m.status}</span>
              </button>
            </li>
          ))}
          {Object.values(s.meetings).every((m) => m.status === 'ended') && <li className="os-empty">No meetings right now</li>}
        </ul>
      </nav>

      <main className="os-map" aria-label="Office map">
        <div ref={mapRef} className="os-map-inner" />
        {s.busy && <div className="os-busy" role="status">Working on it…</div>}
        {s.error && <div className="os-error" role="alert">{s.error}</div>}
      </main>

      <aside className="os-feed" aria-label="Activity">
        <h2>Activity</h2>
        <ol>
          {s.feed.map((ev) => (
            <li key={ev.id} className={`fd-${ev.kind}`}>
              <button type="button" onClick={() => openFeed(ev)}>
                <time>{time(ev.at)}</time>
                <span>{ev.text}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <footer className="os-bottom">
        <dl className="os-stats">
          <div><dt>Agents</dt><dd>{w.total}</dd></div>
          <div><dt>Working</dt><dd>{w.working}</dd></div>
          <div><dt>Meetings</dt><dd>{w.meetings}</dd></div>
          <div><dt>Needs input</dt><dd>{w.blocked}</dd></div>
          <div><dt>Away</dt><dd>{w.away}</dd></div>
          <div><dt>Done</dt><dd>{w.tasksDone}</dd></div>
        </dl>
        <form className="os-command" onSubmit={submitCommand}>
          <label htmlFor="os-cmd" className="sr-only">Office command</label>
          <input
            id="os-cmd"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Ask the team, “ask Priya …”, “have Alex meet with Sam”, “show agents waiting”"
            autoComplete="off"
            list="os-examples"
          />
          <datalist id="os-examples">{EXAMPLES.map((x) => <option key={x} value={x} />)}</datalist>
          <button type="submit" disabled={!command.trim() || s.busy}>Run</button>
        </form>
        <div className="os-task" aria-label="Drag a task onto an agent">
          <input value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="New task…" aria-label="New task" />
          <span
            className="os-chip"
            draggable={!!taskDraft.trim()}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', taskDraft.trim())}
            aria-hidden="true"
          >
            Drag onto an agent
          </span>
        </div>
      </footer>

      {agent && (
        <section className="os-panel" aria-labelledby="panel-title">
          <button type="button" className="os-close" onClick={() => controller?.select(null)} aria-label="Close">×</button>
          <p className="os-kicker">{agent.role}</p>
          <h2 id="panel-title">{agent.name}</h2>
          <dl className="os-facts">
            <div><dt>Status</dt><dd>{STATUS_LABEL[agent.status]}. {agent.statusDetail}</dd></div>
            <div><dt>Location</dt><dd>{s.rooms[agent.room].name}</dd></div>
            <div><dt>Human</dt><dd>{agent.availabilityLabel}</dd></div>
            <div><dt>Current task</dt><dd>{agent.taskId ? s.tasks[agent.taskId]?.title : 'None'}</dd></div>
            <div>
              <dt>Works most with</dt>
              <dd>{edges.filter((e) => e.a === agent.id || e.b === agent.id).slice(0, 3).map((e) => s.agents[e.a === agent.id ? e.b : e.a]?.name.split(' ')[0]).filter(Boolean).join(', ') || 'No collaborations yet'}</dd>
            </div>
          </dl>
          <div className="os-actions">
            <button type="button" className="primary" onClick={() => setChatWith(agent.id)}>Talk to {agent.name.split(' ')[0]}'s agent</button>
          </div>
          <form
            className="os-assign"
            onSubmit={(e) => { e.preventDefault(); if (taskDraft.trim() && controller) { void controller.assignTask(agent.id, taskDraft.trim()); setTaskDraft(''); } }}
          >
            <label htmlFor="os-assign-input">Assign a task</label>
            <input id="os-assign-input" value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="e.g. What remains blocked?" />
            <button type="submit" disabled={!taskDraft.trim()}>Assign</button>
          </form>
        </section>
      )}

      {room && (
        <section className="os-panel" aria-labelledby="panel-title">
          <button type="button" className="os-close" onClick={() => controller?.select(null)} aria-label="Close">×</button>
          <p className="os-kicker">{room.purpose}</p>
          <h2 id="panel-title">{room.name}</h2>
          <ul className="os-list">
            {Object.values(s.agents).filter((a) => a.room === room.id).map((a) => (
              <li key={a.id}><button type="button" onClick={() => controller?.select({ kind: 'agent', id: a.id })}>{a.name} · {STATUS_LABEL[a.status]}</button></li>
            ))}
          </ul>
        </section>
      )}

      {meeting && (
        <section className="os-panel os-panel-wide" aria-labelledby="panel-title">
          <button type="button" className="os-close" onClick={() => controller?.select(null)} aria-label="Close">×</button>
          <p className="os-kicker">Meeting · {meeting.status}</p>
          <h2 id="panel-title">{meeting.title}</h2>
          {meeting.status === 'stuck' && <p className="os-warn">No decision yet. Assign a decision-maker or end the meeting.</p>}
          <p className="os-muted">With {meeting.participants.map((id) => s.agents[id]?.name.split(' ')[0]).join(', ')} · started {time(meeting.startedAt)}</p>
          {meeting.decisions.length > 0 && (
            <>
              <h3>Decisions</h3>
              <ul>{meeting.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </>
          )}
          <h3>Transcript</h3>
          <ol className="os-transcript">
            {meeting.transcript.map((m) => (
              <li key={m.id} className={`msg-${m.kind}`}>
                <strong>{m.from === 'system' ? 'Orchestrator' : s.agents[m.from]?.name.split(' ')[0] ?? m.from}</strong> {m.text}
              </li>
            ))}
          </ol>
          {meeting.status !== 'ended' && (
            <div className="os-actions"><button type="button" onClick={() => controller?.endMeeting(meeting.id)}>End meeting</button></div>
          )}
        </section>
      )}

      {chatWith && controller && s.agents[chatWith] && (
        <AgentChat controller={controller} agentId={chatWith} onClose={() => setChatWith(null)} />
      )}
    </div>
  );
}

// ---- Talking to one agent, by text or voice ----

function AgentChat({ controller, agentId, onClose }: { controller: OfficeController; agentId: string; onClose: () => void }) {
  const s = useOffice(controller);
  const ag = s.agents[agentId];
  const convo = Object.values(s.conversations).find((c) => !c.endedAt && c.participants.includes(agentId) && c.participants.includes('you'));
  const [text, setText] = useState('');
  const voice = useVoice();
  const logRef = useRef<HTMLOListElement>(null);
  const firstName = ag.name.split(' ')[0];

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [convo?.messages.length]);

  const send = async (q: string, spoken: boolean) => {
    const question = q.trim();
    if (!question) return;
    setText('');
    if (spoken) voice.setState('checking');
    const r = await controller.askAgent(agentId, question);
    if (spoken && r && voice.canSpeak) voice.speak(r.brief.answer);
    else if (spoken) voice.setState('ready');
  };

  const status: Record<string, string> = {
    unsupported: 'Voice is not available in this browser. Type instead.',
    denied: 'Microphone permission was refused. Type instead.',
    ready: 'Press Talk and speak. Replies are read aloud.',
    listening: voice.interim ? `“${voice.interim}”` : 'Listening… press Stop when done.',
    transcribing: 'Sending your words…',
    checking: `Checking ${firstName}'s context…`,
    speaking: `${firstName}'s agent is speaking.`,
  };

  return (
    <section className="os-chat" aria-labelledby="chat-title">
      <button type="button" className="os-close" onClick={onClose} aria-label="Close conversation">×</button>
      <p className="os-kicker">Context agent</p>
      <h2 id="chat-title">{firstName}'s context agent</h2>
      <p className="os-boundary">Answers from {firstName}'s stated principles and sources. It is not {firstName}, and it cannot approve anything for {firstName}.</p>
      <ol ref={logRef} className="os-log" aria-live="polite">
        {(convo?.messages ?? []).map((m) => (
          <li key={m.id} className={m.from === 'you' ? 'from-you' : 'from-agent'}>
            <span>{m.from === 'you' ? 'You' : `${firstName}'s agent`}</span>
            <p>{m.text}</p>
          </li>
        ))}
        {ag.status === 'thinking' && <li className="from-agent thinking">Checking {firstName}'s context…</li>}
      </ol>
      {ag.status === 'needs-input' && (
        <button type="button" className="os-link" onClick={() => void navigator.clipboard?.writeText(`Hi ${firstName}, could you confirm: ${convo?.messages.filter((m) => m.from === 'you').at(-1)?.text ?? ''}`)}>
          Copy request for {firstName}
        </button>
      )}
      <div className="os-voice">
        <button
          type="button"
          className={`os-mic mic-${voice.state}`}
          aria-pressed={voice.state === 'listening'}
          disabled={voice.state === 'unsupported' || voice.state === 'checking'}
          onClick={() => (voice.state === 'listening' ? voice.stopListening() : voice.listen((heard) => void send(heard, true)))}
        >
          {voice.state === 'listening' ? 'Stop' : 'Talk'}
        </button>
        {voice.state === 'speaking' && <button type="button" onClick={voice.stopSpeaking}>Stop reply</button>}
        {voice.canSpeak && voice.state !== 'speaking' && convo && <button type="button" onClick={voice.replay}>Replay</button>}
        <p role="status">{status[voice.state]}</p>
      </div>
      <form className="os-chat-input" onSubmit={(e) => { e.preventDefault(); void send(text, false); }}>
        <label htmlFor="os-chat-text" className="sr-only">Message {firstName}'s agent</label>
        <input id="os-chat-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ask ${firstName}'s agent…`} autoComplete="off" />
        <button type="submit" disabled={!text.trim() || s.busy}>Send</button>
      </form>
    </section>
  );
}
