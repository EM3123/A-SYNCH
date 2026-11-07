// The office store: one reducer, a subscription for React (useSyncExternalStore), and an event
// bus the visual layer listens to for animations. Every change goes through dispatch().
import type { AskResponse } from '../api';
import { ROOMS, SEATS, freeSeat, teamOf } from './layout';
import {
  STATUS_LABEL,
  type ActivityEvent, type Agent, type AgentStatus, type Conversation, type Meeting, type Message,
  type OfficeEvent, type OfficeState, type RoomId, type Task,
} from './types';

export type Action =
  | { type: 'roster'; people: Array<Pick<Agent, 'id' | 'name' | 'role' | 'accent' | 'expertise' | 'availability' | 'availabilityLabel'>> }
  | { type: 'move'; agentId: string; room: RoomId; status?: AgentStatus; detail?: string }
  | { type: 'status'; agentId: string; status: AgentStatus; detail?: string }
  | { type: 'meeting-start'; meeting: Meeting }
  | { type: 'meeting-message'; meetingId: string; message: Message }
  | { type: 'meeting-status'; meetingId: string; status: Meeting['status']; decisions?: string[] }
  | { type: 'meeting-end'; meetingId: string }
  | { type: 'conversation-start'; conversation: Conversation }
  | { type: 'conversation-message'; conversationId: string; message: Message }
  | { type: 'conversation-end'; conversationId: string }
  | { type: 'task-upsert'; task: Task }
  | { type: 'brief'; key: string; response: AskResponse }
  | { type: 'feed'; event: ActivityEvent }
  | { type: 'select'; selection: OfficeState['selection'] }
  | { type: 'mode'; mode: OfficeState['mode'] }
  | { type: 'busy'; busy: boolean }
  | { type: 'error'; error: string | null };

let counter = 0;
export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function initialState(): OfficeState {
  return {
    agents: {}, rooms: ROOMS, seats: SEATS, meetings: {}, conversations: {}, tasks: {}, briefs: {},
    feed: [], selection: null, mode: 'animated', busy: false, error: null,
  };
}

// Seats nobody else may take: where others sit now, and every person's own desk (a visitor
// never sits at a teammate's desk, even when that teammate is away).
const takenSeats = (s: OfficeState, except?: string) => {
  const taken = new Set<string>();
  for (const a of Object.values(s.agents)) {
    taken.add(a.homeSeat);
    if (a.id !== except) taken.add(a.seat);
  }
  return taken;
};

// Where an agent sits in a room: their own desk in their team's room, otherwise a free seat.
function seatIn(s: OfficeState, agent: Agent, room: RoomId): string {
  if (room === agent.homeRoom) return agent.homeSeat;
  return freeSeat(room, takenSeats(s, agent.id)) ?? agent.seat;
}

function bump(rel: Record<string, number>, ids: string[], self: string) {
  const out = { ...rel };
  for (const id of ids) if (id !== self && id !== 'you' && id !== 'system') out[id] = (out[id] ?? 0) + 1;
  return out;
}

// Pure reducer. Returns the new state and the animation events implied by the change.
export function reduce(s: OfficeState, a: Action): [OfficeState, OfficeEvent[]] {
  switch (a.type) {
    case 'roster': {
      const agents: Record<string, Agent> = {};
      const homeTaken = new Set<string>();
      const occupied = new Set<string>();
      a.people.forEach((p) => {
        const old = s.agents[p.id];
        // People sit with their team. Real availability decides the starting room: when the
        // human is away, sick or on leave, their agent waits in the out-of-office lounge.
        const { team, teamName, room: homeRoom } = teamOf(p.id, p.role);
        const homeSeat = old?.homeSeat ?? freeSeat(homeRoom, homeTaken) ?? `${homeRoom}-0`;
        homeTaken.add(homeSeat);
        const away = p.availability === 'away';
        const room: RoomId = old?.room ?? (away ? 'break' : homeRoom);
        const seat = old?.seat ?? (away ? freeSeat('break', occupied) ?? 'break-0' : homeSeat);
        occupied.add(seat);
        const status: AgentStatus = old?.status ?? (away ? 'away' : 'working');
        agents[p.id] = {
          ...p,
          team,
          teamName,
          homeRoom,
          room,
          seat,
          homeSeat,
          status,
          statusDetail: old?.statusDetail ?? (p.availability === 'available' ? 'At their desk' : p.availabilityLabel),
          taskId: old?.taskId ?? null,
          relationships: old?.relationships ?? {},
        };
      });
      return [{ ...s, agents }, []];
    }
    case 'move': {
      const ag = s.agents[a.agentId];
      if (!ag) return [s, []];
      const seat = seatIn(s, ag, a.room);
      const status = a.status ?? ag.status;
      const next: Agent = { ...ag, room: a.room, seat, status, statusDetail: a.detail ?? ag.statusDetail };
      const ev: OfficeEvent[] = [{ type: 'agent-walk', agentId: ag.id, from: ag.seat, to: seat }];
      if (status !== ag.status) ev.push({ type: 'agent-status', agentId: ag.id, status });
      return [{ ...s, agents: { ...s.agents, [ag.id]: next } }, ev];
    }
    case 'status': {
      const ag = s.agents[a.agentId];
      if (!ag) return [s, []];
      const next = { ...ag, status: a.status, statusDetail: a.detail ?? STATUS_LABEL[a.status] };
      const icon = a.status === 'completed' ? 'check' : a.status === 'needs-input' ? 'question' : a.status === 'blocked' ? 'warning' : null;
      return [
        { ...s, agents: { ...s.agents, [ag.id]: next } },
        [{ type: 'agent-status', agentId: ag.id, status: a.status }, { type: 'indicator', agentId: ag.id, icon }],
      ];
    }
    case 'meeting-start':
      return [{ ...s, meetings: { ...s.meetings, [a.meeting.id]: a.meeting } }, [{ type: 'meeting', meetingId: a.meeting.id, status: a.meeting.status }]];
    case 'meeting-message': {
      const m = s.meetings[a.meetingId];
      if (!m) return [s, []];
      const agents = { ...s.agents };
      const speaker = agents[a.message.from];
      if (speaker) agents[speaker.id] = { ...speaker, relationships: bump(speaker.relationships, m.participants, speaker.id) };
      return [
        { ...s, agents, meetings: { ...s.meetings, [m.id]: { ...m, transcript: [...m.transcript, a.message] } } },
        speaker ? [{ type: 'speech', agentId: speaker.id, text: a.message.text, kind: a.message.kind, meetingId: m.id }] : [],
      ];
    }
    case 'meeting-status': {
      const m = s.meetings[a.meetingId];
      if (!m) return [s, []];
      const next = { ...m, status: a.status, decisions: a.decisions ?? m.decisions };
      return [{ ...s, meetings: { ...s.meetings, [m.id]: next } }, [{ type: 'meeting', meetingId: m.id, status: a.status }]];
    }
    case 'meeting-end': {
      const m = s.meetings[a.meetingId];
      if (!m) return [s, []];
      return [
        { ...s, meetings: { ...s.meetings, [m.id]: { ...m, status: 'ended', endedAt: Date.now() } } },
        [{ type: 'meeting', meetingId: m.id, status: 'ended' }],
      ];
    }
    case 'conversation-start':
      return [{ ...s, conversations: { ...s.conversations, [a.conversation.id]: a.conversation } }, []];
    case 'conversation-message': {
      const c = s.conversations[a.conversationId];
      if (!c) return [s, []];
      const agents = { ...s.agents };
      const speaker = agents[a.message.from];
      if (speaker) agents[speaker.id] = { ...speaker, relationships: bump(speaker.relationships, c.participants, speaker.id) };
      return [
        { ...s, agents, conversations: { ...s.conversations, [c.id]: { ...c, messages: [...c.messages, a.message] } } },
        speaker ? [{ type: 'speech', agentId: speaker.id, text: a.message.text, kind: a.message.kind, conversationId: c.id }] : [],
      ];
    }
    case 'conversation-end': {
      const c = s.conversations[a.conversationId];
      if (!c) return [s, []];
      return [{ ...s, conversations: { ...s.conversations, [c.id]: { ...c, endedAt: Date.now() } } }, []];
    }
    case 'task-upsert': {
      const agents = { ...s.agents };
      const who = a.task.assignee ? agents[a.task.assignee] : undefined;
      if (who) agents[who.id] = { ...who, taskId: a.task.status === 'done' ? null : a.task.id };
      return [{ ...s, agents, tasks: { ...s.tasks, [a.task.id]: a.task } }, [{ type: 'task', taskId: a.task.id, status: a.task.status }]];
    }
    case 'brief':
      return [{ ...s, briefs: { ...s.briefs, [a.key]: a.response } }, []];
    case 'feed':
      return [{ ...s, feed: [a.event, ...s.feed].slice(0, 200) }, []];
    case 'select':
      return [{ ...s, selection: a.selection }, []];
    case 'mode':
      return [{ ...s, mode: a.mode }, []];
    case 'busy':
      return [{ ...s, busy: a.busy }, []];
    case 'error':
      return [{ ...s, error: a.error }, []];
  }
}

export type Listener = () => void;
export type EventListener = (e: OfficeEvent) => void;

export class OfficeStore {
  private state = initialState();
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();

  getState = () => this.state;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };

  // For the visual layer: walk, speak, sit, show indicators.
  onEvent = (l: EventListener) => {
    this.eventListeners.add(l);
    return () => { this.eventListeners.delete(l); };
  };

  dispatch = (a: Action) => {
    const [next, events] = reduce(this.state, a);
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((l) => l());
    events.forEach((e) => this.eventListeners.forEach((l) => l(e)));
  };

  log(kind: ActivityEvent['kind'], text: string, extra: Partial<ActivityEvent> = {}) {
    this.dispatch({ type: 'feed', event: { id: uid('ev'), at: Date.now(), kind, text, agentIds: [], ...extra } });
  }
}

// ---- Selectors ----

export function workforce(s: OfficeState) {
  const agents = Object.values(s.agents);
  const count = (st: AgentStatus[]) => agents.filter((a) => st.includes(a.status)).length;
  return {
    total: agents.length,
    working: count(['working', 'thinking', 'communicating']),
    idle: count(['waiting', 'completed']),
    away: count(['away']),
    meetings: Object.values(s.meetings).filter((m) => m.status !== 'ended').length,
    blocked: count(['blocked', 'needs-input']),
    tasksDone: Object.values(s.tasks).filter((t) => t.status === 'done').length,
  };
}

export function agentsIn(s: OfficeState, room: RoomId) {
  return Object.values(s.agents).filter((a) => a.room === room);
}

// Strongest working relationships, for the relationship graph.
export function relationshipEdges(s: OfficeState) {
  const seen = new Set<string>();
  const edges: Array<{ a: string; b: string; weight: number }> = [];
  for (const ag of Object.values(s.agents)) {
    for (const [other, w] of Object.entries(ag.relationships)) {
      const key = [ag.id, other].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: ag.id, b: other, weight: w + (s.agents[other]?.relationships[ag.id] ?? 0) });
    }
  }
  return edges.sort((x, y) => y.weight - x.weight);
}
