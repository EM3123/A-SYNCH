// The office floor plan in tiles. Six rooms from the spec. The renderer decides tile size and
// art; these coordinates only define where things are relative to each other.
import type { Room, RoomId, Seat } from './types';

export const GRID = { w: 40, h: 24 };

export const ROOMS: Record<RoomId, Room> = {
  workspace: { id: 'workspace', name: 'Main Workspace', purpose: 'Individual work', bounds: { x: 1, y: 1, w: 18, h: 10 }, door: { x: 10, y: 11 } },
  conference: { id: 'conference', name: 'Conference Room', purpose: 'Formal collaboration', bounds: { x: 20, y: 1, w: 11, h: 10 }, door: { x: 25, y: 11 } },
  operations: { id: 'operations', name: 'Operations', purpose: 'Management and monitoring', bounds: { x: 32, y: 1, w: 7, h: 10 }, door: { x: 35, y: 11 } },
  common: { id: 'common', name: 'Common Area', purpose: 'Informal conversation', bounds: { x: 1, y: 12, w: 18, h: 11 }, door: { x: 10, y: 12 } },
  research: { id: 'research', name: 'Research Room', purpose: 'Information gathering', bounds: { x: 20, y: 12, w: 11, h: 11 }, door: { x: 25, y: 12 } },
  break: { id: 'break', name: 'Break Room', purpose: 'Idle and away', bounds: { x: 32, y: 12, w: 7, h: 11 }, door: { x: 35, y: 12 } },
};

// Seats. Desks in the workspace are assigned to agents as they arrive; the conference table
// has eight chairs; the common area and break room have open seating.
function seats(): Record<string, Seat> {
  const out: Record<string, Seat> = {};
  const add = (s: Seat) => { out[s.id] = s; };
  for (let i = 0; i < 8; i++) {
    add({ id: `desk-${i}`, room: 'workspace', x: 3 + (i % 4) * 4, y: 3 + Math.floor(i / 4) * 4, kind: 'desk' });
  }
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? 0 : 1;
    add({ id: `table-${i}`, room: 'conference', x: 22 + (i % 4) * 2, y: 4 + side * 4, kind: 'table' });
  }
  for (let i = 0; i < 6; i++) {
    add({ id: `common-${i}`, room: 'common', x: 3 + (i % 3) * 5, y: 15 + Math.floor(i / 3) * 4, kind: 'sofa' });
  }
  for (let i = 0; i < 4; i++) {
    add({ id: `research-${i}`, room: 'research', x: 22 + (i % 2) * 5, y: 15 + Math.floor(i / 2) * 4, kind: 'desk' });
  }
  for (let i = 0; i < 3; i++) add({ id: `ops-${i}`, room: 'operations', x: 34, y: 3 + i * 3, kind: 'desk' });
  for (let i = 0; i < 4; i++) add({ id: `break-${i}`, room: 'break', x: 34 + (i % 2) * 2, y: 15 + Math.floor(i / 2) * 3, kind: 'sofa' });
  return out;
}

export const SEATS = seats();

// The first free seat in a room, preferring one this agent already owns.
export function freeSeat(room: RoomId, taken: Set<string>, owner?: string): string | null {
  const list = Object.values(SEATS).filter((s) => s.room === room);
  const own = owner ? list.find((s) => s.owner === owner) : undefined;
  if (own) return own.id;
  return list.find((s) => !taken.has(s.id) && !s.owner)?.id ?? null;
}
