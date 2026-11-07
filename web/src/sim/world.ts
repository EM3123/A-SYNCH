// Simulation for the A-Synch ocean. Pure logic, no drawing.
// Physics follows the coral and kelp spec: divergence-free current, viscous drag,
// Verlet chains for kelp, and reef-fish behavior (schools, home territory, resting).
import type { Status } from '../data';

export interface Vec { x: number; y: number }

export const WATER = 0.25; // waterline as a fraction of viewport height

const scratch: Vec = { x: 0, y: 0 };

// Divergence-free current. Velocity is the curl of a stream function, so the water
// swirls like incompressible fluid and nothing bunches up or disappears.
export function current(x: number, y: number, t: number, out: Vec = scratch): Vec {
  const kx = 0.0042, ky = 0.0051, k3 = 0.0063;
  const a = 0.9, b = 0.6;
  const p1 = kx * x + 0.5 * t;
  const p2 = ky * y - 0.35 * t;
  const p3 = k3 * (x + y) + 0.25 * t;
  const dpdx = a * kx * Math.cos(p1) * Math.cos(p2) + b * k3 * Math.cos(p3);
  const dpdy = -a * ky * Math.sin(p1) * Math.sin(p2) + b * k3 * Math.cos(p3);
  out.x = dpdy * 2000;
  out.y = -dpdx * 2000;
  return out;
}

// ---- Kelp: Verlet chain pinned at one end ----

export interface Stalk {
  base: Vec;
  pts: Vec[];
  prev: Vec[];
  rest: number;
}

// dir = +1 grows downward from the base (farm, pinned at top), -1 grows upward (reef, rooted on the floor).
export function makeStalk(x: number, baseY: number, count: number, rest: number, dir: 1 | -1): Stalk {
  const pts: Vec[] = [];
  for (let i = 0; i < count; i++) pts.push({ x, y: baseY + dir * i * rest });
  return { base: { x, y: baseY }, pts, prev: pts.map((p) => ({ ...p })), rest };
}

export function stepStalk(s: Stalk, t: number, dt: number, avoid: Vec[], calm: number) {
  const n = s.pts.length;
  for (let i = 1; i < n; i++) {
    const p = s.pts[i];
    const q = s.prev[i];
    const vx = (p.x - q.x) * 0.96;
    const vy = (p.y - q.y) * 0.96;
    q.x = p.x;
    q.y = p.y;
    const c = current(p.x, p.y, t);
    p.x += vx + c.x * dt * 0.5 * calm;
    p.y += vy;
    p.x += (s.base.x - p.x) * 0.012; // gentle spring back to upright
    for (const f of avoid) {
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.1 && d < 70) {
        const k = (70 - d) * 0.12;
        p.x += (dx / d) * k;
        p.y += (dy / d) * k;
      }
    }
  }
  // Distance constraints: keep neighboring nodes at rest length.
  for (let iter = 0; iter < 3; iter++) {
    s.pts[0].x = s.base.x;
    s.pts[0].y = s.base.y;
    for (let i = 1; i < n; i++) {
      const a = s.pts[i - 1];
      const b = s.pts[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const diff = (d - s.rest) / d;
      b.x -= dx * diff;
      b.y -= dy * diff;
    }
  }
}

// ---- Fish ----

export interface Fish {
  id: string;
  name: string;
  role: string;
  color: string;
  status: Status;
  kind: 'twin' | 'seeker';
  home: Vec;
  pos: Vec;
  vel: Vec;
  phase: number;
  hooked: boolean;
}

export function reefHomes(W: number, H: number): Record<string, Vec> {
  return {
    backend: { x: W * 0.2, y: H * 0.8 },
    quant: { x: W * 0.48, y: H * 0.88 },
    design: { x: W * 0.76, y: H * 0.8 },
  };
}

const tmp: Vec = { x: 0, y: 0 };

export function stepFish(f: Fish, flock: Fish[], t: number, dt: number, W: number, H: number, calm: number) {
  if (f.hooked) {
    f.phase += dt * 8;
    return;
  }
  const minY = H * WATER + 36;
  const maxY = H - 40;
  let ax = 0;
  let ay = 0;
  let maxSpeed = 26;

  if (f.status === 'away') {
    // Asleep on the floor near home. Gentle drift, low speed.
    const tx = f.home.x + Math.sin(t * 0.2 + f.phase) * 30;
    const ty = maxY - 6;
    ax += (tx - f.pos.x) * 0.2;
    ay += (ty - f.pos.y) * 0.2;
    maxSpeed = 5;
  } else {
    if (f.status === 'available') {
      // Boids on the same school: separation, alignment, cohesion. Research notes that a
      // cohesion-heavy mix forms small subgroups of 2-3, so the cohesion weight stays low.
      let sx = 0;
      let sy = 0;
      let avx = 0;
      let avy = 0;
      let cx = 0;
      let cy = 0;
      let n = 0;
      for (const o of flock) {
        if (o === f || o.kind !== 'twin' || o.hooked || o.status !== 'available') continue;
        const dx = f.pos.x - o.pos.x;
        const dy = f.pos.y - o.pos.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.1 && d < 28) {
          sx += (dx / d) * (28 - d);
          sy += (dy / d) * (28 - d);
        }
        if (d < 120) {
          avx += o.vel.x;
          avy += o.vel.y;
          cx += o.pos.x;
          cy += o.pos.y;
          n++;
        }
      }
      if (n > 0) {
        ax += (avx / n - f.vel.x) * 0.5 + (cx / n - f.pos.x) * 0.02;
        ay += (avy / n - f.vel.y) * 0.5 + (cy / n - f.pos.y) * 0.02;
      }
      ax += sx * 0.9;
      ay += sy * 0.9;
    }
    // Home territory: residents range around their outcrop and return when they stray.
    // Deep-work fish hold closer to home.
    const leash = f.status === 'focus' ? 50 : 170;
    const hx = f.home.x - f.pos.x;
    const hy = f.home.y - f.pos.y;
    if (Math.hypot(hx, hy) > leash) {
      ax += hx * 0.04;
      ay += hy * 0.04;
    }
    if (f.status === 'focus') maxSpeed = 9;
  }

  // Viscous drag toward the local current: a = -b (v - u).
  const c = current(f.pos.x, f.pos.y, t, tmp);
  ax += -0.9 * (f.vel.x - c.x * calm);
  ay += -0.9 * (f.vel.y - c.y * calm);

  f.vel.x += ax * dt * 10;
  f.vel.y += ay * dt * 10;

  const sp = Math.hypot(f.vel.x, f.vel.y);
  if (sp > maxSpeed) {
    f.vel.x *= maxSpeed / sp;
    f.vel.y *= maxSpeed / sp;
  }
  f.pos.x += f.vel.x * dt;
  f.pos.y += f.vel.y * dt;

  // Stay inside the reef.
  if (f.pos.y < minY) { f.pos.y = minY; f.vel.y = Math.abs(f.vel.y) * 0.5; }
  if (f.pos.y > maxY) { f.pos.y = maxY; f.vel.y = -Math.abs(f.vel.y) * 0.5; }
  if (f.pos.x < 0) { f.pos.x = 0; f.vel.x = Math.abs(f.vel.x) * 0.5; }
  if (f.pos.x > W * 0.98) { f.pos.x = W * 0.98; f.vel.x = -Math.abs(f.vel.x) * 0.5; }

  // Tail beat rate rises with speed, like real fish.
  f.phase += dt * (3 + Math.min(sp, maxSpeed) * 0.3);
}

// ---- Bubbles: spawn at a coral base, rise, deflect with the current, pop at the surface ----

export interface Bubble { x: number; y: number; age: number }
export interface Pop { x: number; y: number; age: number; dx: number[]; dy: number[] }

export function stepBubbles(bubbles: Bubble[], pops: Pop[], surfaceY: number, dt: number, t: number, calm: number) {
  for (const b of bubbles) {
    b.age += dt;
    b.y -= 16 * dt * calm; // rise
    const c = current(b.x, b.y, t, tmp);
    b.x += c.x * 0.6 * dt * calm;
  }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (b.y < surfaceY) {
      pops.push({
        x: b.x,
        y: surfaceY,
        age: 0,
        dx: [-6, 0, 6],
        dy: [-4, -7, -4],
      });
      bubbles.splice(i, 1);
    }
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].age += dt;
    if (pops[i].age > 0.5) pops.splice(i, 1);
  }
}

// ---- Fishing cast: drop, bite, reel ----

export interface Cast {
  phase: 'idle' | 'drop' | 'bite' | 'reel' | 'caught';
  t0: number;
  target: string;
  hook: Vec;
  from: Vec;
  tension: number;
}

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// Returns true on the frame the cast reaches "caught".
export function stepCast(c: Cast, now: number, byId: Map<string, Fish>, rod: Vec, surface: Vec): boolean {
  const target = byId.get(c.target);
  if (!target || c.phase === 'idle' || c.phase === 'caught') return false;
  const el = (now - c.t0) / 1000;

  if (c.phase === 'drop') {
    const k = Math.min(1, el / 1.3);
    const e = 1 - Math.pow(1 - k, 3);
    c.hook.x = rod.x + (target.pos.x - rod.x) * e;
    c.hook.y = rod.y + (target.pos.y - rod.y) * e;
    c.tension = 0.15; // slack line, sagging under its own weight
    if (k >= 1) {
      c.phase = 'bite';
      c.t0 = now;
      target.hooked = true;
    }
  } else if (c.phase === 'bite') {
    c.tension = 0.6;
    if (el > 0.6) {
      c.phase = 'reel';
      c.t0 = now;
      c.from = { x: c.hook.x, y: c.hook.y };
    }
  } else if (c.phase === 'reel') {
    const k = Math.min(1, el / 1.8);
    const e = ease(k);
    c.hook.x = c.from.x + (surface.x - c.from.x) * e;
    c.hook.y = c.from.y + (surface.y - c.from.y) * e;
    c.tension = 1;
    target.pos.x = c.hook.x;
    target.pos.y = c.hook.y + 14;
    if (k >= 1) {
      c.phase = 'caught';
      return true;
    }
  }
  return false;
}
