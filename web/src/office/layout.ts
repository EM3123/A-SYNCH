// The office floor plan in tiles, for Corvid Labs (38 people, 17 teams). Six rooms from the spec.
// The renderer decides tile size and art; these coordinates only define where things are
// relative to each other. Desks are generated per room, so any team size fits.
import type { Room, RoomId, Seat } from './types';

export const GRID = { w: 56, h: 32 };

export const ROOMS: Record<RoomId, Room> = {
  workspace: { id: 'workspace', name: 'Atlas Engineering', purpose: 'Backend, frontend, billing and QA', bounds: { x: 1, y: 1, w: 22, h: 13 }, door: { x: 12, y: 14 } },
  conference: { id: 'conference', name: 'Conference Room', purpose: 'Meetings and reviews', bounds: { x: 24, y: 1, w: 14, h: 13 }, door: { x: 30, y: 14 } },
  operations: { id: 'operations', name: 'Platform & Security', purpose: 'Platform, security and data', bounds: { x: 39, y: 1, w: 16, h: 13 }, door: { x: 46, y: 14 } },
  common: { id: 'common', name: 'Customer & Business', purpose: 'Customers, sales, legal, finance and marketing', bounds: { x: 1, y: 15, w: 22, h: 16 }, door: { x: 12, y: 15 } },
  research: { id: 'research', name: 'Product & Design', purpose: 'Leadership, product, design and docs', bounds: { x: 24, y: 15, w: 14, h: 16 }, door: { x: 30, y: 15 } },
  break: { id: 'break', name: 'Out of Office', purpose: 'People who are away, on leave, or offline', bounds: { x: 39, y: 15, w: 16, h: 16 }, door: { x: 46, y: 15 } },
};

// Which team sits in which room.
const TEAM_ROOM: Record<string, RoomId> = {
  'atlas-backend': 'workspace', 'atlas-frontend': 'workspace', billing: 'workspace', qa: 'workspace',
  platform: 'operations', security: 'operations', data: 'operations',
  product: 'research', leadership: 'research', design: 'research', docs: 'research',
  'customer-success': 'common', sales: 'common', marketing: 'common', legal: 'common', finance: 'common', people: 'common',
};

const TEAM_NAME: Record<string, string> = {
  leadership: 'Leadership', product: 'Product', 'atlas-backend': 'Atlas Backend', 'atlas-frontend': 'Atlas Frontend',
  platform: 'Platform', security: 'Security', qa: 'QA', design: 'Design', data: 'Data', billing: 'Billing',
  'customer-success': 'Customer Success', sales: 'Sales', legal: 'Legal', marketing: 'Marketing', people: 'People Ops',
  finance: 'Finance', docs: 'Docs',
};

// Teams for the Corvid Labs corpus (data/corvid-labs/people/people.json). The people API does
// not return a team, so the office keeps this map; unknown people fall back to their role text.
const TEAM_BY_PERSON: Record<string, string> = {
  elena: 'leadership', marcus: 'leadership', priya: 'product', maya: 'product',
  kwame: 'atlas-backend', alex: 'atlas-backend', tomas: 'atlas-backend', wei: 'atlas-backend', grace: 'atlas-backend',
  sam: 'atlas-frontend', nadia: 'atlas-frontend', leo: 'atlas-frontend',
  devon: 'platform', hana: 'platform', ravi: 'platform', jordan: 'security', ingrid: 'security',
  fatima: 'qa', ben: 'qa', chloe: 'design', omar: 'design', sofia: 'data', kenji: 'data',
  ethan: 'billing', lucas: 'billing', laura: 'customer-success', diego: 'customer-success', aisha: 'customer-success',
  mateo: 'customer-success', ryan: 'sales', megan: 'sales', rebecca: 'legal', victor: 'legal',
  jasmine: 'marketing', noah: 'marketing', olivia: 'people', sanjay: 'finance', isabel: 'docs',
};

function teamFromRole(role: string): string {
  const r = role.toLowerCase();
  if (/(ceo|cto|chief)/.test(r)) return 'leadership';
  if (/(sre|infrastructure|platform)/.test(r)) return 'platform';
  if (/(security|identity|access)/.test(r)) return 'security';
  if (/\bqa\b|quality/.test(r)) return 'qa';
  if (/(design|ux)/.test(r)) return 'design';
  if (/(data|analytics)/.test(r)) return 'data';
  if (/(product|program)/.test(r)) return 'product';
  if (/frontend|front-end/.test(r)) return 'atlas-frontend';
  if (/(backend|back-end|engineer)/.test(r)) return 'atlas-backend';
  if (/(customer|support|success)/.test(r)) return 'customer-success';
  if (/(sales|account|solutions)/.test(r)) return 'sales';
  if (/(counsel|legal|compliance)/.test(r)) return 'legal';
  if (/(marketing|content)/.test(r)) return 'marketing';
  if (/finance/.test(r)) return 'finance';
  if (/(people|recruit)/.test(r)) return 'people';
  if (/(writer|docs)/.test(r)) return 'docs';
  return 'atlas-backend';
}

export function teamOf(personId: string, role: string): { team: string; teamName: string; room: RoomId } {
  const team = TEAM_BY_PERSON[personId] ?? teamFromRole(role);
  return { team, teamName: TEAM_NAME[team] ?? team, room: TEAM_ROOM[team] ?? 'workspace' };
}

// Seats: a grid of desks inside each room (three tiles apart, so avatars never overlap), a
// conference table with ten chairs, and sofas in the out-of-office lounge.
function seats(): Record<string, Seat> {
  const out: Record<string, Seat> = {};
  const add = (s: Seat) => { out[s.id] = s; };
  const deskRooms: RoomId[] = ['workspace', 'operations', 'research', 'common'];
  for (const id of deskRooms) {
    const b = ROOMS[id].bounds;
    const cols = Math.floor((b.w - 2) / 3);
    const rows = Math.floor((b.h - 3) / 3);
    for (let i = 0; i < cols * rows; i++) {
      add({ id: `${id}-${i}`, room: id, x: b.x + 2 + (i % cols) * 3, y: b.y + 3 + Math.floor(i / cols) * 3, kind: 'desk' });
    }
  }
  const c = ROOMS.conference.bounds;
  for (let i = 0; i < 10; i++) {
    add({ id: `conference-${i}`, room: 'conference', x: c.x + 2 + (i % 5) * 2.4, y: c.y + 4 + Math.floor(i / 5) * 4, kind: 'table' });
  }
  const br = ROOMS.break.bounds;
  const bcols = Math.floor((br.w - 2) / 3);
  for (let i = 0; i < 20; i++) {
    add({ id: `break-${i}`, room: 'break', x: br.x + 2 + (i % bcols) * 3, y: br.y + 3 + Math.floor(i / bcols) * 3, kind: 'sofa' });
  }
  return out;
}

export const SEATS = seats();

// The first free seat in a room.
export function freeSeat(room: RoomId, taken: Set<string>): string | null {
  return Object.values(SEATS).find((s) => s.room === room && !taken.has(s.id))?.id ?? null;
}
