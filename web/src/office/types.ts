// OfficeOS domain model. This is the "middle end": what the office knows, independent of how
// it is drawn. The visual layer reads OfficeState and plays OfficeEvents; it never decides
// that work happened. Only the backend (through the adapter) changes real state.
import type { AskResponse } from '../api';

export type RoomId = 'workspace' | 'conference' | 'common' | 'research' | 'operations' | 'break';

// Every state has a text label (see STATUS_LABEL) so nothing depends on animation or color alone.
export type AgentStatus =
  | 'working' // at desk
  | 'thinking' // thought bubble
  | 'communicating' // speech bubble
  | 'walking' // moving between rooms
  | 'meeting' // seated at the conference table
  | 'waiting' // idle, available
  | 'blocked' // warning indicator
  | 'completed' // checkmark
  | 'needs-input' // question mark: a human must act
  | 'away'; // the human is unavailable; their agent still answers

export interface Seat {
  id: string;
  room: RoomId;
  // Abstract tile coordinates. The renderer maps tiles to pixels.
  x: number;
  y: number;
  kind: 'desk' | 'table' | 'sofa' | 'standing';
  owner?: string; // agent id for assigned desks
}

export interface Room {
  id: RoomId;
  name: string;
  purpose: string;
  // Bounds in tiles: x, y, width, height.
  bounds: { x: number; y: number; w: number; h: number };
  // Door tile, for walking paths.
  door: { x: number; y: number };
}

export type TaskStatus = 'queued' | 'in-progress' | 'done' | 'blocked';

export interface Task {
  id: string;
  title: string;
  assignee: string | null;
  status: TaskStatus;
  progress: number | null; // 0..1 when the backend reports it, otherwise null
  source: 'user' | 'orchestrator';
  createdAt: number;
  responseId?: string; // backend requestId that produced or completed it
}

export interface Message {
  id: string;
  at: number;
  from: string; // agent id, 'you' for the manager, 'system' for the orchestrator
  text: string;
  kind: 'speech' | 'thought' | 'system';
  evidenceIds?: string[];
}

export type MeetingStatus = 'gathering' | 'discussing' | 'decided' | 'stuck' | 'ended';

export interface Meeting {
  id: string;
  title: string;
  room: RoomId;
  participants: string[];
  startedAt: number;
  endedAt?: number;
  agenda: string[];
  status: MeetingStatus;
  decisions: string[];
  transcript: Message[];
  responseId?: string;
  // 'calendar' meetings come from the seeded calendars (someone is genuinely in a meeting);
  // 'asked' meetings are created when the manager asks the team.
  source?: 'calendar' | 'asked';
  until?: string; // plain-language end time from the calendar, e.g. "until 4:30 PM ET"
}

export interface Conversation {
  id: string;
  participants: string[]; // includes 'you' when the manager is talking
  room: RoomId;
  startedAt: number;
  endedAt?: number;
  messages: Message[];
}

export type ActivityKind =
  | 'agent-moved'
  | 'status'
  | 'meeting-started'
  | 'meeting-decided'
  | 'meeting-stuck'
  | 'meeting-ended'
  | 'conversation'
  | 'task-assigned'
  | 'task-completed'
  | 'needs-input'
  | 'security'
  | 'error';

export interface ActivityEvent {
  id: string;
  at: number;
  kind: ActivityKind;
  text: string;
  agentIds: string[];
  room?: RoomId;
  meetingId?: string;
  conversationId?: string;
  taskId?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  accent: string;
  expertise: string[];
  // The human's real availability, from the backend.
  availability: 'available' | 'busy' | 'away';
  availabilityLabel: string;
  // Where the agent is and what it is doing in the office.
  team: string;
  teamName: string;
  homeRoom: RoomId; // the room their team sits in
  room: RoomId;
  seat: string;
  homeSeat: string; // the agent's own desk; they return here after meetings
  status: AgentStatus;
  statusDetail: string; // plain-language line shown in profiles and tooltips
  taskId: string | null;
  // How often this agent worked with others, built from meetings and conversations.
  relationships: Record<string, number>;
}

export interface OfficeState {
  agents: Record<string, Agent>;
  rooms: Record<RoomId, Room>;
  seats: Record<string, Seat>;
  meetings: Record<string, Meeting>;
  conversations: Record<string, Conversation>;
  tasks: Record<string, Task>;
  // The backend's full answer for a meeting or conversation (brief, sources, security events),
  // keyed by meeting id or conversation id. Panels render from this, never from the feed text.
  briefs: Record<string, AskResponse>;
  feed: ActivityEvent[]; // newest first
  selection: { kind: 'agent' | 'room' | 'meeting' | 'conversation'; id: string } | null;
  mode: 'animated' | 'simplified';
  busy: boolean; // a backend request is in flight
  error: string | null;
}

// Events the visual layer can animate. They describe what changed, after the state changed.
export type OfficeEvent =
  | { type: 'agent-walk'; agentId: string; from: string; to: string }
  | { type: 'agent-status'; agentId: string; status: AgentStatus }
  | { type: 'speech'; agentId: string; text: string; kind: Message['kind']; conversationId?: string; meetingId?: string }
  | { type: 'meeting'; meetingId: string; status: MeetingStatus }
  | { type: 'task'; taskId: string; status: TaskStatus }
  | { type: 'indicator'; agentId: string; icon: 'check' | 'question' | 'warning' | null };

export const STATUS_LABEL: Record<AgentStatus, string> = {
  working: 'Working',
  thinking: 'Thinking',
  communicating: 'Talking',
  walking: 'Walking',
  meeting: 'In a meeting',
  waiting: 'Available',
  blocked: 'Blocked',
  completed: 'Done',
  'needs-input': 'Needs input',
  away: 'Away',
};
