// The interaction layer. It turns user intent into backend calls, and backend responses into
// office activity (moves, meetings, conversations, feed entries, tasks).
//
// Rule from the spec: the office visualises the agent system, it is not the agent system.
// A task is only "done" when a backend response arrives, never because an animation ended.
import { askPerson, askTeam, loadPeople, type AskResponse, type PersonProfile } from '../api';
import { OfficeStore, uid, workforce } from './store';
import type { Message, OfficeState } from './types';

const STUCK_AFTER_MS = 90_000; // a meeting with no decision after this long is flagged as stuck
const STEP_MS = 550; // pacing between replayed steps in animated mode

export interface OfficeController {
  store: OfficeStore;
  load(): Promise<void>;
  askTeam(question: string): Promise<AskResponse | null>;
  askAgent(agentId: string, question: string): Promise<AskResponse | null>;
  assignTask(agentId: string, title: string): Promise<void>;
  startMeeting(agentIds: string[], title: string): string;
  endMeeting(meetingId: string): void;
  command(text: string): Promise<void>;
  select(sel: OfficeState['selection']): void;
  setMode(mode: OfficeState['mode']): void;
  agentByName(name: string): string | null;
  destroy(): void;
}

export function createOfficeController(requesterId: string): OfficeController {
  const store = new OfficeStore();
  const { dispatch } = store;
  const state = () => store.getState();
  const timers = new Set<number>();
  const name = (id: string) => state().agents[id]?.name ?? id;
  const first = (id: string) => name(id).split(' ')[0];

  // Run steps one after another; immediately in simplified mode.
  const sequence = (steps: Array<() => void>) =>
    new Promise<void>((resolve) => {
      if (state().mode === 'simplified') {
        steps.forEach((f) => f());
        resolve();
        return;
      }
      let i = 0;
      const tick = () => {
        if (i >= steps.length) { resolve(); return; }
        steps[i++]();
        const t = window.setTimeout(() => { timers.delete(t); tick(); }, STEP_MS);
        timers.add(t);
      };
      tick();
    });

  const msg = (from: string, text: string, kind: Message['kind'] = 'speech', evidenceIds?: string[]): Message =>
    ({ id: uid('m'), at: Date.now(), from, text, kind, evidenceIds });

  // Send an agent back to where they belong: their team's desk, or the out-of-office lounge if
  // their human is away. If the human is in a calendar meeting, the agent stays in that meeting.
  const goHome = (id: string) => {
    const ag = state().agents[id];
    if (!ag) return;
    const away = ag.availability === 'away';
    const calendar = Object.values(state().meetings).find((m) => m.source === 'calendar' && m.status !== 'ended' && m.participants.includes(id));
    if (calendar && !away) {
      dispatch({ type: 'move', agentId: id, room: 'conference', status: 'meeting', detail: ag.availabilityLabel });
      return;
    }
    dispatch({ type: 'move', agentId: id, room: away ? 'break' : ag.homeRoom, status: away ? 'away' : 'working', detail: away ? ag.availabilityLabel : 'At their desk' });
  };

  const fail = (err: unknown) => {
    const text = err instanceof Error ? err.message : 'Something went wrong.';
    dispatch({ type: 'error', error: text });
    store.log('error', text);
  };

  // Stuck-meeting check: no decision after a while means the agents are going in circles.
  const stuckTimer = window.setInterval(() => {
    const now = Date.now();
    for (const m of Object.values(state().meetings)) {
      if (m.source !== 'calendar' && (m.status === 'gathering' || m.status === 'discussing') && now - m.startedAt > STUCK_AFTER_MS) {
        dispatch({ type: 'meeting-status', meetingId: m.id, status: 'stuck' });
        store.log('meeting-stuck', `“${m.title}” has run ${Math.round((now - m.startedAt) / 60000)} min without a decision`, { meetingId: m.id, agentIds: m.participants, room: m.room });
      }
    }
  }, 5000);

  const toRoster = (people: PersonProfile[]) =>
    people.map((p) => ({
      id: p.id, name: p.name, role: p.role, accent: p.accent, expertise: p.expertise,
      availability: p.availability, availabilityLabel: p.availabilityLabel,
    }));

  const controller: OfficeController = {
    store,

    async load() {
      try {
        const people = await loadPeople();
        dispatch({ type: 'roster', people: toRoster(people) });
        store.log('status', `${people.length} agents at Corvid Labs. Calendars as of Fri Nov 6, 2:30 PM ET (seeded).`);

        // People who are genuinely in a meeting right now (from the seeded calendars). Everyone
        // sharing the same calendar reason is in the same meeting, and their agents sit in the
        // conference room. Away, sick and on-leave people stay in the out-of-office lounge.
        const groups = new Map<string, string[]>();
        for (const p of people) {
          if (p.availability !== 'busy') continue;
          groups.set(p.availabilityLabel, [...(groups.get(p.availabilityLabel) ?? []), p.id]);
        }
        for (const [label, ids] of groups) {
          const until = label.match(/\buntil\b.*$/i)?.[0];
          const title = label.replace(/\s+until\b.*$/i, '');
          const meetingId = uid('cal');
          dispatch({
            type: 'meeting-start',
            meeting: { id: meetingId, title, room: 'conference', participants: ids, startedAt: Date.now(), agenda: [label], status: 'discussing', decisions: [], transcript: [], source: 'calendar', until },
          });
          ids.forEach((id) => dispatch({ type: 'move', agentId: id, room: 'conference', status: 'meeting', detail: label }));
          store.log('meeting-started', `${ids.map(first).join(', ')} ${ids.length === 1 ? 'is' : 'are'} in “${title}” ${until ?? ''}`.trim(), { meetingId, agentIds: ids, room: 'conference' });
        }
      } catch (err) {
        fail(err);
      }
    },

    // Ask the whole team. The backend picks who to consult; they meet in the conference room,
    // the routing steps play back as the meeting, and the brief becomes the decision.
    async askTeam(question) {
      const taskId = uid('task');
      dispatch({ type: 'task-upsert', task: { id: taskId, title: question, assignee: null, status: 'in-progress', progress: null, source: 'user', createdAt: Date.now() } });
      dispatch({ type: 'busy', busy: true });
      dispatch({ type: 'error', error: null });
      store.log('task-assigned', `You asked the team: “${question}”`, { taskId });
      try {
        const r = await askTeam(question, requesterId);
        const ids = r.selectedPeople.map((p) => p.id).filter((id) => state().agents[id]);
        const meetingId = uid('mtg');
        dispatch({
          type: 'meeting-start',
          meeting: { id: meetingId, title: r.brief.title, room: 'conference', participants: ids, startedAt: Date.now(), agenda: [question], status: 'gathering', decisions: [], transcript: [], responseId: r.requestId },
        });
        store.log('meeting-started', `${ids.map(first).join(', ')} met about “${r.brief.title}”`, { meetingId, agentIds: ids, room: 'conference' });

        const steps: Array<() => void> = [];
        ids.forEach((id) => steps.push(() => dispatch({ type: 'move', agentId: id, room: 'conference', status: 'meeting', detail: `In “${r.brief.title}”` })));
        steps.push(() => dispatch({ type: 'meeting-status', meetingId, status: 'discussing' }));
        r.routingEvents.forEach((e) => steps.push(() => {
          const from = e.personId && state().agents[e.personId] ? e.personId : 'system';
          dispatch({ type: 'meeting-message', meetingId, message: msg(from, e.label, from === 'system' ? 'system' : 'speech') });
        }));
        r.brief.relevantPeople.forEach((p) => steps.push(() => {
          if (state().agents[p.personId]) {
            dispatch({ type: 'meeting-message', meetingId, message: msg(p.personId, p.reason, 'speech', p.evidenceIds) });
          }
        }));
        steps.push(() => {
          dispatch({ type: 'meeting-status', meetingId, status: 'decided', decisions: [r.brief.status, r.brief.nextStep] });
          // Keep the backend's full answer and open it: the Situation Brief is the centerpiece.
          dispatch({ type: 'brief', key: meetingId, response: r });
          dispatch({ type: 'select', selection: { kind: 'meeting', id: meetingId } });
          store.log('meeting-decided', `${r.brief.status}. Next: ${r.brief.nextStep}`, { meetingId, agentIds: ids });
          r.securityEvents.forEach((e) => store.log('security', e.label, { meetingId }));
        });
        steps.push(() => {
          dispatch({ type: 'meeting-end', meetingId });
          ids.forEach(goHome);
          if (r.brief.trust.requiresHuman && state().agents[r.brief.ownerId]) {
            dispatch({ type: 'status', agentId: r.brief.ownerId, status: 'needs-input', detail: r.brief.trust.reasons.join(' ') || 'A human decision is needed' });
            store.log('needs-input', `${name(r.brief.ownerId)} needs to decide: ${r.brief.nextStep}`, { agentIds: [r.brief.ownerId] });
          }
          dispatch({ type: 'task-upsert', task: { id: taskId, title: question, assignee: null, status: 'done', progress: 1, source: 'user', createdAt: Date.now(), responseId: r.requestId } });
          store.log('task-completed', `Brief ready: ${r.brief.answer}`, { taskId, meetingId });
        });
        await sequence(steps);
        return r;
      } catch (err) {
        dispatch({ type: 'task-upsert', task: { id: taskId, title: question, assignee: null, status: 'blocked', progress: null, source: 'user', createdAt: Date.now() } });
        fail(err);
        return null;
      } finally {
        dispatch({ type: 'busy', busy: false });
      }
    },

    // Talk to one agent. They come to the common area, you talk, they go back.
    async askAgent(agentId, question) {
      const ag = state().agents[agentId];
      if (!ag) return null;
      const convo = Object.values(state().conversations).find((c) => !c.endedAt && c.participants.includes(agentId) && c.participants.includes('you'));
      const conversationId = convo?.id ?? uid('conv');
      if (!convo) {
        dispatch({ type: 'conversation-start', conversation: { id: conversationId, participants: ['you', agentId], room: ag.room, startedAt: Date.now(), messages: [] } });
        dispatch({ type: 'status', agentId, status: 'communicating', detail: 'Talking with you' });
        store.log('conversation', `You started talking with ${first(agentId)}'s agent`, { conversationId, agentIds: [agentId], room: ag.room });
      }
      dispatch({ type: 'conversation-message', conversationId, message: msg('you', question) });
      dispatch({ type: 'status', agentId, status: 'thinking', detail: `Checking ${first(agentId)}'s context` });
      dispatch({ type: 'busy', busy: true });
      try {
        const r = await askPerson(agentId, question, requesterId);
        const evidence = [...new Set(r.brief.claims.flatMap((c) => c.evidenceIds))];
        dispatch({ type: 'conversation-message', conversationId, message: msg(agentId, r.brief.answer, 'speech', evidence) });
        dispatch({ type: 'brief', key: conversationId, response: r });
        if (r.brief.trust.requiresHuman) {
          dispatch({ type: 'status', agentId, status: 'needs-input', detail: `Only ${first(agentId)} can decide this` });
          store.log('needs-input', `${first(agentId)}'s agent cannot approve this. A request for ${first(agentId)} is ready.`, { agentIds: [agentId], conversationId });
        } else {
          dispatch({ type: 'status', agentId, status: 'communicating', detail: 'Talking with you' });
        }
        r.securityEvents.forEach((e) => store.log('security', e.label, { conversationId }));
        return r;
      } catch (err) {
        dispatch({ type: 'status', agentId, status: 'blocked', detail: 'Could not reach the backend' });
        fail(err);
        return null;
      } finally {
        dispatch({ type: 'busy', busy: false });
      }
    },

    // Assigning a task: the agent goes to their desk and works. The backend produces the result,
    // and only then is the task marked done.
    async assignTask(agentId, title) {
      const ag = state().agents[agentId];
      if (!ag) return;
      const taskId = uid('task');
      dispatch({ type: 'task-upsert', task: { id: taskId, title, assignee: agentId, status: 'in-progress', progress: null, source: 'user', createdAt: Date.now() } });
      dispatch({ type: 'move', agentId, room: ag.homeRoom, status: 'working', detail: `Working on “${title}”` });
      store.log('task-assigned', `${first(agentId)} took “${title}”`, { agentIds: [agentId], taskId });
      try {
        const r = await askPerson(agentId, title, requesterId);
        dispatch({ type: 'task-upsert', task: { id: taskId, title, assignee: agentId, status: r.brief.trust.requiresHuman ? 'blocked' : 'done', progress: 1, source: 'user', createdAt: Date.now(), responseId: r.requestId } });
        dispatch({ type: 'status', agentId, status: r.brief.trust.requiresHuman ? 'needs-input' : 'completed', detail: r.brief.answer });
        store.log(r.brief.trust.requiresHuman ? 'needs-input' : 'task-completed', `${first(agentId)}: ${r.brief.answer}`, { agentIds: [agentId], taskId });
      } catch (err) {
        dispatch({ type: 'task-upsert', task: { id: taskId, title, assignee: agentId, status: 'blocked', progress: null, source: 'user', createdAt: Date.now() } });
        dispatch({ type: 'status', agentId, status: 'blocked', detail: 'Could not reach the backend' });
        fail(err);
      }
    },

    // A meeting the manager calls. Without a backend meeting API it gathers people and holds an
    // agenda; it is ended by the manager (or flagged as stuck).
    startMeeting(agentIds, title) {
      const ids = agentIds.filter((id) => state().agents[id]);
      const meetingId = uid('mtg');
      dispatch({ type: 'meeting-start', meeting: { id: meetingId, title, room: 'conference', participants: ids, startedAt: Date.now(), agenda: [title], status: 'gathering', decisions: [], transcript: [], } });
      ids.forEach((id) => dispatch({ type: 'move', agentId: id, room: 'conference', status: 'meeting', detail: `In “${title}”` }));
      store.log('meeting-started', `You called ${ids.map(first).join(', ')} into “${title}”`, { meetingId, agentIds: ids, room: 'conference' });
      return meetingId;
    },

    endMeeting(meetingId) {
      const m = state().meetings[meetingId];
      if (!m || m.status === 'ended') return;
      dispatch({ type: 'meeting-end', meetingId });
      m.participants.forEach(goHome);
      store.log('meeting-ended', `“${m.title}” ended`, { meetingId, agentIds: m.participants });
    },

    // Office-wide commands from the bottom bar. Anything unrecognised is asked of the team.
    async command(text) {
      const t = text.trim();
      if (!t) return;
      const ask = t.match(/^(?:ask|talk to|tell)\s+([a-z]+)[,:]?\s+(.+)$/i);
      if (ask) {
        const id = controller.agentByName(ask[1]);
        if (id) { await controller.askAgent(id, ask[2]); return; }
      }
      const meet = t.match(/^(?:have|get)?\s*(.+?)\s+(?:meet|meeting)\s+(?:with\s+)?(.+)$/i);
      if (meet) {
        const ids = `${meet[1]} ${meet[2]}`.split(/[\s,]+|and/i).map((n) => controller.agentByName(n)).filter((x): x is string => !!x);
        if (ids.length >= 2) { controller.startMeeting([...new Set(ids)], t); return; }
      }
      if (/\b(progress|status|what.*doing)\b/i.test(t)) {
        const w = workforce(state());
        store.log('status', `${w.working} working, ${w.meetings} meeting${w.meetings === 1 ? '' : 's'}, ${w.blocked} need input or blocked, ${w.away} away`);
        return;
      }
      if (/\b(waiting|needs? input|blocked)\b/i.test(t)) {
        const list = Object.values(state().agents).filter((a) => a.status === 'needs-input' || a.status === 'blocked');
        store.log('status', list.length ? `Waiting on: ${list.map((a) => `${a.name} (${a.statusDetail})`).join('; ')}` : 'Nobody is waiting for input');
        return;
      }
      await controller.askTeam(t);
    },

    select(sel) {
      dispatch({ type: 'select', selection: sel });
    },

    setMode(mode) {
      dispatch({ type: 'mode', mode });
    },

    agentByName(n) {
      const key = n.trim().toLowerCase();
      if (!key) return null;
      const hit = Object.values(state().agents).find((a) => a.id === key || a.name.toLowerCase().split(' ')[0] === key || a.name.toLowerCase() === key);
      return hit?.id ?? null;
    },

    destroy() {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(stuckTimer);
    },
  };
  return controller;
}

