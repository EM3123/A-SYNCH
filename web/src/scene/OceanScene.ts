// The landing ocean. One class owns the simulation and drawing; the React page drives it
// through a few methods (setRoster, search, playTeam, playPerson) and hears back through
// onPick and onHover. Physics notes:
// - Water particles move in circular orbits under waves, shrinking with depth (exp(-k*depth)).
// - The boat sits on the computed surface and tilts with its slope.
// - Fish steer with arrive behaviour, avoid each other, drift with the current, flee a fast
//   cursor and get curious about a slow one.
// - Jellyfish swim by pulsing: the bell contracts, pushes up, then glides and sinks.
import type { PersonProfile } from '../api';
import { availabilityToStatus } from '../api';
import { outcropFor, type OutcropId } from '../data';
import { current, makeStalk, stepStalk, type Stalk, type Vec } from '../sim/world';
import { drawCoral, drawKelp } from '../sim/draw';
import { drawFishBody, drawTinyFish, INK, NAVY, CYAN, RED, SLATE } from './fish';

type Avail = 'available' | 'focus' | 'away';

interface Swimmer {
  id: string;
  name: string;
  role: string;
  label: string;
  color: string;
  status: Avail;
  kind: 'twin' | 'seeker';
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  phase: number;
  len: number;
  home: Vec;
  wander: Vec;
  wanderAt: number;
  hooked: boolean;
  struggle: number;
  blinkAt: number;
  blink: number;
}

interface Tiny { x: number; y: number; vx: number; vy: number; phase: number }
interface Snow { x: number; y: number; z: number }
interface Jelly { x: number; y: number; vy: number; phase: number; r: number; arms: Stalk[] }
interface Bubble { x: number; y: number; r: number; vy: number; wob: number; life: number }
interface Ripple { x: number; t0: number; strength: number }
interface Mote { t: number; from: string; to: string }

type CastStage = 'none' | 'flick' | 'flight' | 'sink' | 'search' | 'approach' | 'bite' | 'reel' | 'release';
type TalkStage = 'none' | 'go' | 'talk' | 'back';

export interface OceanOptions {
  onPick?: (personId: string) => void;
  onHover?: (personId: string | null) => void;
}

const SPACING = 14;
// Three wave trains plus a travelling swell. Amplitude in px, wavelength in px, speed in rad/s.
const WAVES = [
  { A: 6, L: 460, w: 0.9 },
  { A: 3.5, L: 210, w: 1.5 },
  { A: 1.6, L: 95, w: 2.4 },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export class OceanScene {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private time = 0;
  private reduced = false;
  private opts: OceanOptions;

  private surfaceY = 0;
  private seabedY = 0;
  private swellX = 0;

  private fish: Swimmer[] = [];
  private seeker: Swimmer | null = null;
  private school: Tiny[] = [];
  private schoolLead: Vec & { vx: number; vy: number } = { x: 0, y: 0, vx: 30, vy: 0 };
  private snow: Snow[] = [];
  private jellies: Jelly[] = [];
  private bubbles: Bubble[] = [];
  private ripples: Ripple[] = [];
  private kelp: Stalk[] = [];
  private motes: Mote[] = [];

  private pointer = { x: -9999, y: -9999, vx: 0, vy: 0, inside: false, t: 0 };
  private hovered: string | null = null;

  // Cast state
  private stage: CastStage = 'none';
  private stageT = 0;
  private queue: string[] = [];
  private target: Swimmer | null = null;
  private lure: Vec & { vx: number; vy: number } = { x: 0, y: 0, vx: 0, vy: 0 };
  private flightFrom: Vec = { x: 0, y: 0 };
  private flightTo: Vec = { x: 0, y: 0 };
  private reelFrom: Vec = { x: 0, y: 0 };
  private flick = 0;
  private searching = false;

  // Person-talk state
  private talk: TalkStage = 'none';
  private talkT = 0;
  private talkTo: Swimmer | null = null;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, opts: OceanOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.opts = opts;
    this.resize();
    this.seedAmbient();
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('resize', this.resize);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('resize', this.resize);
  }

  setReduced(on: boolean) {
    this.reduced = on;
  }

  setRoster(people: PersonProfile[]) {
    const homes = this.homes();
    const prev = new Map(this.fish.map((f) => [f.id, f]));
    this.fish = people.map((p, i) => {
      const old = prev.get(p.id);
      const home = { ...homes[outcropFor(p.id)] };
      home.x += ((i % 3) - 1) * 50;
      const status = availabilityToStatus(p.availability);
      const base: Swimmer = old ?? {
        id: p.id, name: p.name, role: p.role, label: p.availabilityLabel, color: p.accent, status, kind: 'twin',
        x: home.x + (i % 2 ? 60 : -60), y: home.y - 80, vx: i % 2 ? -10 : 10, vy: 0, heading: i % 2 ? Math.PI : 0,
        phase: i * 1.3, len: 64, home, wander: { ...home }, wanderAt: 0, hooked: false, struggle: 0,
        blinkAt: 2 + i, blink: 0,
      };
      return { ...base, name: p.name, role: p.role, label: p.availabilityLabel, color: p.accent, status, home };
    });
  }

  // Waiting for an answer: cast and let the lure hang with a sonar pulse.
  search() {
    this.searching = true;
    if (this.stage === 'none') this.beginCast(this.W * 0.58);
  }

  // Team answer: hook each selected person in turn.
  playTeam(ids: string[]) {
    this.searching = false;
    this.queue = ids.filter((id) => this.fish.some((f) => f.id === id)).slice(0, 3);
    if (this.reduced) { this.queue = []; this.stage = 'none'; return; }
    if (this.stage === 'search' || this.stage === 'sink') this.nextTarget();
    else if (this.stage === 'none' && this.queue.length) this.beginCast(this.fishById(this.queue[0])?.x ?? this.W * 0.58);
  }

  // Person answer: your fish swims to theirs and they trade a stream of data motes.
  playPerson(id: string) {
    this.searching = false;
    this.stage = 'none';
    const to = this.fishById(id);
    if (!to || !this.seeker || this.reduced) return;
    this.talkTo = to;
    this.talk = 'go';
    this.talkT = 0;
  }

  // ---- Setup ----

  private homes(): Record<OutcropId, Vec> {
    return {
      backend: { x: this.W * 0.2, y: this.seabedY - 70 },
      quant: { x: this.W * 0.52, y: this.seabedY - 60 },
      design: { x: this.W * 0.8, y: this.seabedY - 70 },
    };
  }

  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.surfaceY = this.H * 0.3;
    this.seabedY = this.H - 34;
    this.kelp = [
      makeStalk(this.W * 0.04, this.seabedY, 14, (this.H * 0.42) / 13, -1),
      makeStalk(this.W * 0.07, this.seabedY, 11, (this.H * 0.3) / 10, -1),
      makeStalk(this.W * 0.95, this.seabedY, 15, (this.H * 0.45) / 14, -1),
    ];
    const homes = this.homes();
    this.fish.forEach((f, i) => {
      const h = { ...homes[outcropFor(f.id)] };
      h.x += ((i % 3) - 1) * 50;
      f.home = h;
    });
    this.seeker = {
      id: 'you', name: 'You', role: '', label: '', color: CYAN, status: 'available', kind: 'seeker',
      x: this.W * 0.36, y: this.surfaceY + 70, vx: 0, vy: 0, heading: 0, phase: 0, len: 52,
      home: { x: this.W * 0.36, y: this.surfaceY + 70 }, wander: { x: this.W * 0.36, y: this.surfaceY + 70 },
      wanderAt: 0, hooked: false, struggle: 0, blinkAt: 3, blink: 0,
    };
  };

  private seedAmbient() {
    this.snow = Array.from({ length: 140 }, () => ({
      x: Math.random() * this.W,
      y: this.surfaceY + Math.random() * (this.H - this.surfaceY),
      z: 0.25 + Math.random() * 0.75,
    }));
    this.schoolLead = { x: this.W * 0.3, y: this.surfaceY + (this.seabedY - this.surfaceY) * 0.45, vx: 28, vy: 0 };
    this.school = Array.from({ length: 22 }, () => ({
      x: this.schoolLead.x + (Math.random() - 0.5) * 120,
      y: this.schoolLead.y + (Math.random() - 0.5) * 50,
      vx: 28,
      vy: 0,
      phase: Math.random() * 6,
    }));
    this.jellies = [0.68, 0.86].map((fx, i) => {
      const x = this.W * fx;
      const y = this.surfaceY + 120 + i * 90;
      return {
        x, y, vy: 0, phase: i * 1.7, r: 20 - i * 4,
        arms: Array.from({ length: 5 }, (_, k) => makeStalk(x + (k - 2) * 6, y, 9, 7, 1)),
      };
    });
  }

  // ---- Water ----

  // Surface height offset at x (negative = up) and its slope.
  private surface(x: number, t: number): { h: number; slope: number } {
    let h = 0;
    let slope = 0;
    for (const w of WAVES) {
      const k = (2 * Math.PI) / w.L;
      const th = k * x - w.w * t;
      h -= w.A * Math.cos(th);
      slope += w.A * k * Math.sin(th);
    }
    // Travelling swell, moving toward the boat from the right.
    const env = Math.exp(-Math.pow((x - this.swellX) / 240, 2));
    const ks = (2 * Math.PI) / 300;
    const ths = ks * x + 1.6 * t;
    h -= 16 * env * Math.cos(ths);
    slope += 16 * env * ks * Math.sin(ths);
    return { h, slope };
  }

  // ---- Pointer ----

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const now = performance.now();
    const dt = Math.max(1, now - this.pointer.t) / 1000;
    this.pointer.vx = (x - this.pointer.x) / dt;
    this.pointer.vy = (y - this.pointer.y) / dt;
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.t = now;
    this.pointer.inside = true;
    const hit = this.fishAt(x, y);
    const id = hit?.id ?? null;
    if (id !== this.hovered) {
      this.hovered = id;
      this.canvas.style.cursor = id ? 'pointer' : 'default';
      this.opts.onHover?.(id);
    }
  };

  private onLeave = () => {
    this.pointer.inside = false;
    this.pointer.x = -9999;
    this.pointer.y = -9999;
    if (this.hovered) {
      this.hovered = null;
      this.opts.onHover?.(null);
    }
  };

  private onDown = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const hit = this.fishAt(x, y);
    if (hit) {
      this.opts.onPick?.(hit.id);
      return;
    }
    if (y > this.surfaceY) {
      // A tap in the water: a ripple, a few bubbles, and nearby fish dart away.
      this.ripples.push({ x, t0: this.time, strength: 1 });
      for (let i = 0; i < 6; i++) this.spawnBubble(x + (Math.random() - 0.5) * 16, y, 1.5 + Math.random() * 2);
      this.scare(x, y, 160);
    }
  };

  private fishAt(x: number, y: number): Swimmer | undefined {
    return this.fish.find((f) => Math.hypot(f.x - x, f.y - y) < f.len * 0.6);
  }

  private fishById(id: string) {
    return this.fish.find((f) => f.id === id);
  }

  private scare(x: number, y: number, r: number) {
    for (const f of this.fish) {
      if (f.hooked) continue;
      const dx = f.x - x;
      const dy = f.y - y;
      const d = Math.hypot(dx, dy);
      if (d < r && d > 1) {
        const k = (1 - d / r) * 160;
        f.vx += (dx / d) * k;
        f.vy += (dy / d) * k;
      }
    }
    for (const s of this.school) {
      const dx = s.x - x;
      const dy = s.y - y;
      const d = Math.hypot(dx, dy);
      if (d < r * 1.4 && d > 1) {
        s.vx += (dx / d) * 120;
        s.vy += (dy / d) * 120;
      }
    }
  }

  private spawnBubble(x: number, y: number, r: number) {
    this.bubbles.push({ x, y, r, vy: 18 + r * 8, wob: Math.random() * 6, life: 0 });
  }

  // ---- Cast choreography ----

  private beginCast(landX: number) {
    this.stage = 'flick';
    this.stageT = 0;
    this.flightTo = { x: clamp(landX, this.W * 0.4, this.W * 0.9), y: this.surfaceY };
  }

  private nextTarget() {
    const id = this.queue.shift();
    this.target = id ? this.fishById(id) ?? null : null;
    if (!this.target) {
      this.stage = this.searching ? 'search' : 'none';
      return;
    }
    this.stage = 'approach';
    this.stageT = 0;
  }

  // ---- Frame ----

  private frame = (now: number) => {
    // Cap the step at 0.1s so a slow frame keeps real time without the physics exploding.
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.reduced) this.time += dt;
    this.update(this.reduced ? 0 : dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    const t = this.time;
    const { W } = this;
    this.swellX = W + 300 - ((t * 70) % (W + 700));

    // Pointer speed decays when it stops moving.
    this.pointer.vx *= 0.9;
    this.pointer.vy *= 0.9;

    this.updateCast(dt);
    this.updateTalk(dt);
    for (const f of this.fish) this.updateFish(f, dt);
    if (this.seeker && this.talk === 'none') this.updateSeekerIdle(this.seeker, dt);
    this.updateSchool(dt);
    this.updateJellies(dt);
    this.updateParticles(dt);

    const avoid: Vec[] = this.fish.map((f) => ({ x: f.x, y: f.y }));
    if (this.pointer.inside) avoid.push({ x: this.pointer.x, y: this.pointer.y });
    for (const k of this.kelp) stepStalk(k, t, dt, avoid, 1);

    this.ripples = this.ripples.filter((r) => t - r.t0 < 3);
  }

  private updateCast(dt: number) {
    if (this.stage === 'none') return;
    this.stageT += dt;
    const k = this.stageT;
    const rod = this.rodTip();
    if (this.stage === 'flick') {
      // Rod loads back, then whips forward.
      this.flick = k < 0.25 ? -k / 0.25 : -1 + ((k - 0.25) / 0.2) * 1.6;
      if (k > 0.45) {
        this.flick = 0.6;
        this.stage = 'flight';
        this.stageT = 0;
        this.flightFrom = { ...rod };
      }
    } else if (this.stage === 'flight') {
      // Projectile arc to the landing point.
      this.flick *= 0.9;
      const u = Math.min(1, k / 0.8);
      this.lure.x = this.flightFrom.x + (this.flightTo.x - this.flightFrom.x) * u;
      // Arc height stays inside the sky, even on short screens.
      const arc = Math.min(110, Math.max(20, this.flightFrom.y - 24));
      this.lure.y = this.flightFrom.y + (this.flightTo.y - this.flightFrom.y) * u - Math.sin(u * Math.PI) * arc;
      if (u >= 1) {
        this.ripples.push({ x: this.lure.x, t0: this.time, strength: 1.4 });
        for (let i = 0; i < 10; i++) this.spawnBubble(this.lure.x + (Math.random() - 0.5) * 20, this.surfaceY + 6, 1 + Math.random() * 2.5);
        this.scare(this.lure.x, this.surfaceY + 40, 200);
        this.stage = 'sink';
        this.stageT = 0;
        this.lure.vx = 0;
        this.lure.vy = 0;
      }
    } else if (this.stage === 'sink') {
      this.flick *= 0.9;
      const depthGoal = this.surfaceY + (this.seabedY - this.surfaceY) * 0.55;
      this.lure.y = Math.min(depthGoal, this.lure.y + 70 * dt);
      this.lure.x += Math.sin(this.time * 2) * 6 * dt + current(this.lure.x, this.lure.y, this.time).x * 0.3 * dt;
      if (this.lure.y >= depthGoal) {
        if (this.queue.length) this.nextTarget();
        else { this.stage = this.searching ? 'search' : 'release'; this.stageT = 0; }
      }
    } else if (this.stage === 'search') {
      this.lure.x += Math.sin(this.time * 1.3) * 10 * dt;
      this.lure.y += Math.sin(this.time * 2.1) * 6 * dt;
      if (!this.searching && !this.queue.length) { this.stage = 'release'; this.stageT = 0; }
    } else if (this.stage === 'approach' && this.target) {
      // The target swims to the lure; everyone else carries on.
      const f = this.target;
      if (Math.hypot(f.x - this.lure.x, f.y - this.lure.y) < f.len * 0.45 || k > 6) {
        f.hooked = true;
        this.stage = 'bite';
        this.stageT = 0;
      }
    } else if (this.stage === 'bite' && this.target) {
      this.target.struggle = 1;
      if (k > 0.5) {
        this.stage = 'reel';
        this.stageT = 0;
        this.reelFrom = { x: this.lure.x, y: this.lure.y };
      }
    } else if (this.stage === 'reel' && this.target) {
      const u = Math.min(1, k / 1.8);
      const e = ease(u);
      const goal = { x: rod.x - 30, y: this.surfaceY + 30 };
      this.lure.x = this.reelFrom.x + (goal.x - this.reelFrom.x) * e;
      this.lure.y = this.reelFrom.y + (goal.y - this.reelFrom.y) * e;
      const f = this.target;
      f.struggle = 0.6 + Math.sin(k * 18) * 0.3;
      f.x = this.lure.x - Math.cos(f.heading) * f.len * 0.42;
      f.y = this.lure.y + 4;
      f.heading = Math.PI / 2 + Math.sin(k * 9) * 0.5;
      if (u >= 1) { this.stage = 'release'; this.stageT = 0; }
    } else if (this.stage === 'release') {
      if (this.target) {
        this.target.hooked = false;
        this.target.struggle = 0;
        this.target.vy = 60;
        this.target.wanderAt = 0;
        this.target = null;
      }
      if (this.queue.length) {
        this.beginCast(this.fishById(this.queue[0])?.x ?? this.W * 0.6);
      } else {
        // Reel the empty line home.
        const u = Math.min(1, k / 0.8);
        this.lure.x += (rod.x - this.lure.x) * u;
        this.lure.y += (rod.y - this.lure.y) * u;
        if (u >= 1) this.stage = 'none';
      }
    }
  }

  private updateTalk(dt: number) {
    const me = this.seeker;
    const to = this.talkTo;
    if (this.talk === 'none' || !me || !to) return;
    this.talkT += dt;
    if (this.talk === 'go') {
      const goal = { x: to.x - Math.sign(to.x - me.home.x || 1) * 70, y: to.y - 6 };
      this.steer(me, goal.x, goal.y, 140, 3.2, dt);
      this.integrate(me, dt);
      if (Math.hypot(me.x - goal.x, me.y - goal.y) < 12 || this.talkT > 5) {
        this.talk = 'talk';
        this.talkT = 0;
      }
    } else if (this.talk === 'talk') {
      // Face each other, trade data motes.
      me.vx *= 0.9;
      me.vy *= 0.9;
      me.heading = Math.atan2(to.y - me.y, to.x - me.x);
      to.heading = Math.atan2(me.y - to.y, me.x - to.x);
      if (Math.random() < dt * 10) {
        const forward = Math.random() < 0.5;
        this.motes.push({ t: 0, from: forward ? 'you' : to.id, to: forward ? to.id : 'you' });
      }
      me.phase += dt * 3;
      if (this.talkT > 2.4) { this.talk = 'back'; this.talkT = 0; }
    } else if (this.talk === 'back') {
      this.steer(me, me.home.x, me.home.y, 120, 2.6, dt);
      this.integrate(me, dt);
      if (Math.hypot(me.x - me.home.x, me.y - me.home.y) < 10 || this.talkT > 5) {
        this.talk = 'none';
        this.talkTo = null;
      }
    }
  }

  private steer(f: Swimmer, tx: number, ty: number, maxSpeed: number, accel: number, dt: number) {
    const dx = tx - f.x;
    const dy = ty - f.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = Math.min(maxSpeed, d * 1.4);
    f.vx += ((dx / d) * speed - f.vx) * clamp(accel * dt, 0, 1);
    f.vy += ((dy / d) * speed - f.vy) * clamp(accel * dt, 0, 1);
  }

  private integrate(f: Swimmer, dt: number) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    const sp = Math.hypot(f.vx, f.vy);
    if (sp > 4) {
      const target = Math.atan2(f.vy, f.vx);
      let d = target - f.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      f.heading += d * clamp(dt * 4, 0, 1);
    }
    // Tail beat speeds up with swimming speed.
    f.phase += dt * (3 + sp * 0.09);
  }

  private updateFish(f: Swimmer, dt: number) {
    if (f.hooked) {
      f.phase += dt * 14;
      return;
    }
    const t = this.time;

    // Blink now and then.
    f.blinkAt -= dt;
    if (f.blinkAt < 0) { f.blink = 1; f.blinkAt = 2.5 + Math.random() * 4; }
    f.blink = Math.max(0, f.blink - dt * 8);

    if (this.stage === 'approach' && this.target === f) {
      this.steer(f, this.lure.x - f.len * 0.4, this.lure.y, 120, 3, dt);
      this.integrate(f, dt);
      return;
    }
    if (this.talkTo === f && this.talk !== 'none') {
      f.vx *= 0.92;
      f.vy *= 0.92;
      this.integrate(f, dt);
      return;
    }

    if (f.status === 'away') {
      // Resting on the seabed near home, breathing slowly.
      this.steer(f, f.home.x + Math.sin(f.phase * 0.05) * 6, this.seabedY - 12, 8, 1.2, dt);
      this.integrate(f, dt);
      f.phase -= dt * 2.2;
      f.heading *= 0.97;
      if (Math.random() < dt * 0.5) this.spawnBubble(f.x + 20, f.y - 6, 1.2);
      return;
    }

    // Wander around home. Focused fish keep a tight radius.
    const radius = f.status === 'focus' ? 50 : 200;
    f.wanderAt -= dt;
    if (f.wanderAt <= 0) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      f.wander = {
        x: f.home.x + Math.cos(a) * r,
        y: clamp(f.home.y + Math.sin(a) * r * 0.6, this.surfaceY + 50, this.seabedY - 30),
      };
      f.wanderAt = 3 + Math.random() * 4;
    }
    const max = f.status === 'focus' ? 26 : 46;
    this.steer(f, f.wander.x, f.wander.y, max, 0.8, dt);

    // Separation from other fish.
    for (const o of this.fish) {
      if (o === f) continue;
      const dx = f.x - o.x;
      const dy = f.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.1 && d < 70) {
        f.vx += (dx / d) * (70 - d) * dt * 3;
        f.vy += (dy / d) * (70 - d) * dt * 3;
      }
    }

    // Cursor: a fast cursor reads as a predator, a slow one as something to look at.
    if (this.pointer.inside && f.status !== 'focus') {
      const dx = f.x - this.pointer.x;
      const dy = f.y - this.pointer.y;
      const d = Math.hypot(dx, dy);
      const pSpeed = Math.hypot(this.pointer.vx, this.pointer.vy);
      if (d < 150 && pSpeed > 700) {
        f.vx += (dx / d) * 260 * dt * 4;
        f.vy += (dy / d) * 260 * dt * 4;
      } else if (d < 220 && d > 90 && pSpeed < 200) {
        f.vx -= (dx / d) * 30 * dt;
        f.vy -= (dy / d) * 30 * dt;
      }
    }

    // Drift with the current.
    const c = current(f.x, f.y, t);
    f.vx += c.x * 0.4 * dt;
    f.vy += c.y * 0.4 * dt;

    const sp = Math.hypot(f.vx, f.vy);
    const cap = max * 3;
    if (sp > cap) { f.vx *= cap / sp; f.vy *= cap / sp; }
    f.vx *= 1 - dt * 0.6;
    f.vy *= 1 - dt * 0.6;
    this.integrate(f, dt);
    f.y = clamp(f.y, this.surfaceY + 40, this.seabedY - 16);
    f.x = clamp(f.x, 30, this.W - 30);

    // Look at the hovered spot: the hovered fish turns toward the cursor.
    if (this.hovered === f.id) {
      const look = Math.atan2(this.pointer.y - f.y, this.pointer.x - f.x);
      let d = look - f.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      f.heading += d * clamp(dt * 3, 0, 1);
      f.vx *= 0.9;
      f.vy *= 0.9;
    }
  }

  private updateSeekerIdle(me: Swimmer, dt: number) {
    // Your fish hovers by the boat and follows the cursor a little when it is nearby.
    let tx = me.home.x + Math.sin(this.time * 0.4) * 30;
    let ty = me.home.y + Math.sin(this.time * 0.7) * 10;
    if (this.pointer.inside && this.pointer.y > this.surfaceY && Math.hypot(this.pointer.x - me.x, this.pointer.y - me.y) < 260) {
      tx = (tx + this.pointer.x) / 2;
      ty = (ty + this.pointer.y) / 2;
    }
    this.steer(me, tx, ty, 50, 1.2, dt);
    this.integrate(me, dt);
  }

  private updateSchool(dt: number) {
    const L = this.schoolLead;
    const t = this.time;
    // The lead wanders across mid-water and wraps around the screen.
    L.vy += (Math.sin(t * 0.3) * 8 - L.vy) * dt;
    L.x += L.vx * dt;
    L.y = clamp(L.y + L.vy * dt, this.surfaceY + 80, this.seabedY - 120);
    if (L.x > this.W + 160) L.x = -160;
    for (const s of this.school) {
      // Cohesion to the lead, separation from neighbours, alignment with the lead.
      const dx = L.x - s.x;
      const dy = L.y - s.y;
      s.vx += (dx * 0.6 + (L.vx - s.vx) * 1.2) * dt;
      s.vy += (dy * 0.6 + (L.vy - s.vy) * 1.2) * dt;
      for (const o of this.school) {
        if (o === s) continue;
        const ex = s.x - o.x;
        const ey = s.y - o.y;
        const d = Math.hypot(ex, ey);
        if (d > 0.1 && d < 14) {
          s.vx += (ex / d) * 40 * dt;
          s.vy += (ey / d) * 40 * dt;
        }
      }
      if (this.pointer.inside) {
        const px = s.x - this.pointer.x;
        const py = s.y - this.pointer.y;
        const d = Math.hypot(px, py);
        if (d < 90 && d > 0.1) {
          s.vx += (px / d) * 300 * dt;
          s.vy += (py / d) * 300 * dt;
        }
      }
      s.vx *= 1 - dt * 0.8;
      s.vy *= 1 - dt * 0.8;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x > this.W + 200) s.x -= this.W + 400;
      s.phase += dt * (6 + Math.hypot(s.vx, s.vy) * 0.1);
    }
  }

  private updateJellies(dt: number) {
    const t = this.time;
    for (const j of this.jellies) {
      // Pulse: a short contraction pushes up, then a long glide while it sinks slowly.
      const cycle = (t * 0.55 + j.phase) % 1;
      if (cycle < 0.18) j.vy -= 55 * dt;
      j.vy += 8 * dt;
      j.vy *= 1 - dt * 0.9;
      j.y = clamp(j.y + j.vy * dt, this.surfaceY + 70, this.seabedY - 160);
      j.x += current(j.x, j.y, t).x * 0.5 * dt;
      if (j.x > this.W + 40) j.x = -40;
      if (j.x < -40) j.x = this.W + 40;
      j.arms.forEach((a, k) => {
        a.base.x = j.x + (k - 2) * j.r * 0.32;
        a.base.y = j.y + j.r * 0.15;
        stepStalk(a, t, dt, [], 1);
      });
    }
  }

  private updateParticles(dt: number) {
    const t = this.time;
    for (const s of this.snow) {
      const c = current(s.x, s.y, t);
      s.y += (4 + s.z * 7) * dt;
      s.x += c.x * 0.5 * s.z * dt;
      if (s.y > this.seabedY) { s.y = this.surfaceY + 4; s.x = Math.random() * this.W; }
      if (s.x < 0) s.x += this.W;
      if (s.x > this.W) s.x -= this.W;
    }
    for (const b of this.bubbles) {
      b.life += dt;
      b.y -= b.vy * dt;
      b.x += Math.sin(b.life * 5 + b.wob) * 10 * dt;
    }
    // Bubbles pop at the surface with a tiny ripple.
    this.bubbles = this.bubbles.filter((b) => {
      if (b.y > this.surfaceY + 2) return true;
      if (b.r > 2) this.ripples.push({ x: b.x, t0: this.time, strength: 0.25 });
      return false;
    });
    // Occasional bubble from a coral.
    if (Math.random() < dt * 1.2) {
      const homes = Object.values(this.homes());
      const h = homes[Math.floor(Math.random() * homes.length)];
      this.spawnBubble(h.x + (Math.random() - 0.5) * 40, h.y + 40, 1 + Math.random() * 1.5);
    }
    for (const m of this.motes) m.t += dt * 0.9;
    this.motes = this.motes.filter((m) => m.t < 1);
  }

  private rodTip(): Vec {
    const bx = this.W * 0.26;
    const s = this.surface(bx, this.time);
    const tilt = Math.atan(s.slope) * 0.8;
    const base = { x: bx + 22, y: this.surfaceY + s.h - 34 };
    const ang = -0.75 + this.flick * 0.45 + tilt;
    const len = 120;
    return { x: base.x + Math.cos(ang) * len, y: base.y + Math.sin(ang) * len };
  }

  // ---- Draw ----

  private draw() {
    const { ctx, W, H, dpr } = this;
    const t = this.time;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, W, H);

    // Parallax from the pointer: far layers move less.
    const px = this.pointer.inside ? (this.pointer.x / W - 0.5) : 0;
    const py = this.pointer.inside ? (this.pointer.y / H - 0.5) : 0;

    this.drawSky(px);
    this.drawRays(t, px);
    this.drawSnow(px, py, false);
    this.drawSchool(px);
    this.drawSeabed(t);
    this.drawWaterDots(t);
    this.drawJellies(t);
    this.drawBubbles();
    this.drawMotes();
    for (const f of this.fish) this.drawSwimmer(f);
    if (this.seeker) this.drawSwimmer(this.seeker);
    this.drawSurface(t);
    this.drawBoat(t);
    this.drawLine(t);
    this.drawSnow(px, py, true);
    this.drawHoverLabel();
  }

  private drawSky(px: number) {
    const { ctx, W } = this;
    // A crescent moon in ink, and a few faint stars.
    const mx = W * 0.6 - px * 10;
    const my = this.surfaceY * 0.38;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(mx, my, 26, Math.PI * 0.35, Math.PI * 1.65);
    ctx.quadraticCurveTo(mx - 6, my, mx + 26 * Math.cos(Math.PI * 0.35), my + 26 * Math.sin(Math.PI * 0.35));
    ctx.stroke();
    ctx.fillStyle = 'rgba(244,244,240,0.5)';
    for (let i = 0; i < 26; i++) {
      const sx = ((i * 137.5) % 1) * W + (i * 97) % W;
      const sy = (i * 53) % (this.surfaceY * 0.8);
      const tw = 0.5 + 0.5 * Math.sin(this.time * 1.5 + i);
      ctx.globalAlpha = 0.2 + tw * 0.4;
      ctx.fillRect(sx % W, sy, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
  }

  private drawRays(t: number, px: number) {
    const { ctx, W, H } = this;
    // Light shafts from the surface, swaying slowly. Very low alpha so text stays readable.
    for (let i = 0; i < 5; i++) {
      const x = W * (0.15 + i * 0.18) + Math.sin(t * 0.15 + i * 1.7) * 30 - px * 20;
      const w = 30 + (i % 3) * 22;
      const lean = 90 + Math.sin(t * 0.1 + i) * 30;
      const g = ctx.createLinearGradient(0, this.surfaceY, 0, H * 0.85);
      g.addColorStop(0, 'rgba(244,244,240,0.055)');
      g.addColorStop(1, 'rgba(244,244,240,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, this.surfaceY);
      ctx.lineTo(x + w, this.surfaceY);
      ctx.lineTo(x + w * 2.4 + lean, H * 0.85);
      ctx.lineTo(x + lean, H * 0.85);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawSnow(px: number, py: number, near: boolean) {
    const { ctx } = this;
    ctx.fillStyle = INK;
    for (const s of this.snow) {
      if ((s.z > 0.85) !== near) continue;
      const ox = -px * (s.z - 0.4) * 40;
      const oy = -py * (s.z - 0.4) * 20;
      ctx.globalAlpha = 0.08 + s.z * 0.3;
      const r = 0.6 + s.z * 1.2;
      ctx.fillRect(s.x + ox, s.y + oy, r, r);
    }
    ctx.globalAlpha = 1;
  }

  private drawSchool(px: number) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(138,153,174,0.28)';
    for (const s of this.school) {
      drawTinyFish(ctx, s.x - px * 14, s.y, Math.atan2(s.vy, s.vx), s.phase, 6);
    }
  }

  private drawSeabed(t: number) {
    const { ctx, W } = this;
    const y0 = this.seabedY;
    // Sand: a soft ridge line and stippled dots below it.
    ctx.strokeStyle = 'rgba(244,244,240,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) {
      const y = y0 + Math.sin(x * 0.012) * 4 + Math.sin(x * 0.031) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(138,153,174,0.3)';
    for (let x = 4; x < W; x += 9) {
      for (let y = y0 + 8; y < this.H; y += 7) {
        if (((x * 13 + y * 7) % 5) === 0) ctx.fillRect(x, y, 1, 1);
      }
    }
    // Rocks
    const rocks = [[0.12, 30, 16], [0.36, 22, 12], [0.63, 34, 18], [0.9, 26, 14]];
    ctx.strokeStyle = INK;
    ctx.fillStyle = NAVY;
    ctx.lineWidth = 1.3;
    for (const [fx, rw, rh] of rocks) {
      const x = W * fx;
      ctx.beginPath();
      ctx.moveTo(x - rw, y0 + 2);
      ctx.bezierCurveTo(x - rw, y0 - rh, x - rw * 0.2, y0 - rh * 1.3, x + rw * 0.4, y0 - rh * 0.9);
      ctx.bezierCurveTo(x + rw, y0 - rh * 0.6, x + rw, y0 - 2, x + rw, y0 + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Coral outcrops and kelp
    Object.values(this.homes()).forEach((h, i) => drawCoral(ctx, h.x, this.seabedY - 6, i + 1, t, 1));
    for (const k of this.kelp) drawKelp(ctx, k, true);
  }

  // The water column as a dot matrix. Each dot follows a wave orbit that shrinks with depth,
  // is pushed by the cursor and by ripples, and dims with depth like light falling off.
  private drawWaterDots(t: number) {
    const { ctx, W } = this;
    const top = this.surfaceY + 10;
    const bottom = this.seabedY - 10;
    const moonX = W * 0.6;
    for (let y0 = top; y0 < bottom; y0 += SPACING) {
      const depth = y0 - this.surfaceY;
      const fall = Math.exp(-depth / 260);
      for (let x0 = 0; x0 <= W; x0 += SPACING) {
        let x = x0;
        let y = y0;
        for (const w of WAVES) {
          const k = (2 * Math.PI) / w.L;
          const th = k * x0 - w.w * t;
          const a = w.A * Math.exp(-k * depth);
          x -= a * Math.sin(th);
          y -= a * Math.cos(th);
        }
        // Ripples push dots outward as a ring.
        for (const r of this.ripples) {
          const age = t - r.t0;
          const dx = x0 - r.x;
          const dy = y0 - this.surfaceY;
          const d = Math.hypot(dx, dy);
          const ring = age * 140;
          const band = Math.abs(d - ring);
          if (band < 26) {
            const push = (1 - band / 26) * 7 * r.strength * Math.exp(-age * 1.2);
            x += (dx / (d || 1)) * push;
            y += (dy / (d || 1)) * push;
          }
        }
        // Cursor pushes dots aside.
        if (this.pointer.inside) {
          const dx = x - this.pointer.x;
          const dy = y - this.pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < 90 && d > 0.1) {
            const push = (1 - d / 90) * 14;
            x += (dx / d) * push;
            y += (dy / d) * push;
          }
        }
        // Moonlight column near the surface.
        const moon = Math.exp(-Math.pow((x0 - moonX) / 40, 2)) * Math.exp(-depth / 70);
        const shimmer = moon * (0.5 + 0.5 * Math.sin(t * 3 + x0 * 0.1 + y0 * 0.2));
        const a = 0.06 + fall * 0.22 + shimmer * 0.6;
        const s = 1 + fall * 0.9 + shimmer;
        ctx.fillStyle = shimmer > 0.15 ? `rgba(244,244,240,${a})` : `rgba(138,153,174,${a})`;
        ctx.fillRect(x, y, s, s);
      }
    }
  }

  private drawSurface(t: number) {
    const { ctx, W } = this;
    // The surface itself: Gerstner crests are sharp, troughs are round.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let x0 = -20; x0 <= W + 20; x0 += 6) {
      let x = x0;
      let y = this.surfaceY;
      for (const w of WAVES) {
        const k = (2 * Math.PI) / w.L;
        const th = k * x0 - w.w * t;
        x -= w.A * Math.sin(th);
        y -= w.A * Math.cos(th);
      }
      const env = Math.exp(-Math.pow((x0 - this.swellX) / 240, 2));
      y += -16 * env * Math.cos(((2 * Math.PI) / 300) * x0 + 1.6 * t);
      for (const r of this.ripples) {
        const d = Math.abs(x0 - r.x);
        const ring = (t - r.t0) * 140;
        if (Math.abs(d - ring) < 20) y += Math.sin((d - ring) * 0.3) * 3 * r.strength * Math.exp(-(t - r.t0));
      }
      if (x0 === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Foam where the swell is steep: a few cream dots near its crest.
    ctx.fillStyle = INK;
    for (let x0 = this.swellX - 200; x0 < this.swellX + 200; x0 += 7) {
      const s = this.surface(x0, t);
      if (s.slope < -0.14) {
        ctx.globalAlpha = Math.min(1, -s.slope * 2.5);
        ctx.fillRect(x0 + Math.sin(x0 + t * 9) * 3, this.surfaceY + s.h - 2 - Math.random() * 5, 1.6, 1.6);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawBoat(t: number) {
    const { ctx } = this;
    const bx = this.W * 0.26;
    const s = this.surface(bx, t);
    const tilt = Math.atan(s.slope) * 0.8;
    const by = this.surfaceY + s.h;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(tilt);
    ctx.strokeStyle = INK;
    ctx.fillStyle = NAVY;
    ctx.lineWidth = 1.7;
    ctx.lineJoin = 'round';
    // Hull, double-inked
    ctx.beginPath();
    ctx.moveTo(-78, -18);
    ctx.bezierCurveTo(-40, -14, 30, -14, 74, -20);
    ctx.lineTo(56, 6);
    ctx.bezierCurveTo(20, 10, -36, 10, -60, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-66, -8);
    ctx.bezierCurveTo(-30, -5, 20, -5, 62, -10);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Angler: body, head, cap
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8, -16);
    ctx.bezierCurveTo(-10, -36, -2, -44, 8, -43);
    ctx.bezierCurveTo(16, -42, 20, -32, 18, -16);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, -52, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2, -55);
    ctx.quadraticCurveTo(6, -62, 16, -55);
    ctx.stroke();
    // Lantern at the bow
    ctx.beginPath();
    ctx.moveTo(-70, -18);
    ctx.lineTo(-74, -40);
    ctx.stroke();
    const g = ctx.createRadialGradient(-74, -44, 0, -74, -44, 20);
    g.addColorStop(0, 'rgba(0,169,244,0.45)');
    g.addColorStop(1, 'rgba(0,169,244,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(-74, -44, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CYAN;
    ctx.fillRect(-76, -46, 4, 4);
    ctx.restore();

    // Rod, drawn in world space so the flick reads clearly
    const rod = this.rodTip();
    const hand = { x: bx + Math.cos(tilt) * 22 - Math.sin(tilt) * -34, y: by + Math.sin(tilt) * 22 + Math.cos(tilt) * -34 };
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hand.x, hand.y);
    ctx.quadraticCurveTo((hand.x + rod.x) / 2, (hand.y + rod.y) / 2 - 10 - this.flick * 12, rod.x, rod.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hand.x - 10, hand.y + 6);
    ctx.lineTo(hand.x, hand.y);
    ctx.stroke();
  }

  private drawLine(t: number) {
    if (this.stage === 'none' || this.stage === 'flick') return;
    const { ctx } = this;
    const rod = this.rodTip();
    const taut = this.stage === 'bite' || this.stage === 'reel';
    const mx = (rod.x + this.lure.x) / 2;
    const my = (rod.y + this.lure.y) / 2;
    // Slack line sags; a taut one runs straight and vibrates slightly.
    const sag = taut ? 0 : Math.min(80, Math.hypot(this.lure.x - rod.x, this.lure.y - rod.y) * 0.18);
    const buzz = taut ? Math.sin(t * 60) * 1.2 : 0;
    ctx.strokeStyle = taut ? CYAN : 'rgba(244,244,240,0.75)';
    ctx.lineWidth = taut ? 1.2 : 1;
    ctx.beginPath();
    ctx.moveTo(rod.x, rod.y);
    ctx.quadraticCurveTo(mx + buzz, my + sag, this.lure.x, this.lure.y);
    ctx.stroke();

    // Lure: a small hook with a cyan bead
    ctx.save();
    ctx.translate(this.lure.x, this.lure.y);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 12);
    ctx.bezierCurveTo(0, 20, -9, 20, -9, 12);
    ctx.lineTo(-6, 9);
    ctx.stroke();
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.arc(0, -2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sonar while searching
    if (this.stage === 'search' || this.stage === 'sink') {
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const u = ((t * 0.7 + i * 0.5) % 1);
        ctx.globalAlpha = (1 - u) * 0.6;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.arc(this.lure.x, this.lure.y + 10, 10 + u * 70, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  private drawJellies(t: number) {
    const { ctx } = this;
    for (const j of this.jellies) {
      const cycle = (t * 0.55 + j.phase) % 1;
      const squeeze = cycle < 0.18 ? Math.sin((cycle / 0.18) * Math.PI) : 0;
      const w = j.r * (1 - squeeze * 0.22);
      const h = j.r * (0.85 + squeeze * 0.2);
      // Tentacles
      ctx.strokeStyle = 'rgba(244,244,240,0.5)';
      ctx.lineWidth = 1;
      for (const a of j.arms) {
        ctx.beginPath();
        ctx.moveTo(a.pts[0].x, a.pts[0].y);
        for (let i = 1; i < a.pts.length - 1; i++) {
          const m = { x: (a.pts[i].x + a.pts[i + 1].x) / 2, y: (a.pts[i].y + a.pts[i + 1].y) / 2 };
          ctx.quadraticCurveTo(a.pts[i].x, a.pts[i].y, m.x, m.y);
        }
        ctx.stroke();
      }
      // Bell
      ctx.beginPath();
      ctx.moveTo(j.x - w, j.y);
      ctx.bezierCurveTo(j.x - w, j.y - h * 1.3, j.x + w, j.y - h * 1.3, j.x + w, j.y);
      ctx.quadraticCurveTo(j.x, j.y + h * 0.25, j.x - w, j.y);
      ctx.fillStyle = 'rgba(3,15,24,0.75)';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // Inner canals and glowing rim
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 0.8;
      for (const k of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(j.x + k * w * 0.6, j.y - h * 0.9);
        ctx.lineTo(j.x + k * w * 0.9, j.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = CYAN;
      for (let i = 0; i < 5; i++) {
        const u = -1 + i * 0.5;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i);
        ctx.fillRect(j.x + u * w - 1, j.y - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawBubbles() {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(244,244,240,0.6)';
    ctx.lineWidth = 0.9;
    for (const b of this.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      if (b.r > 1.8) {
        ctx.fillStyle = 'rgba(244,244,240,0.7)';
        ctx.fillRect(b.x - b.r * 0.4, b.y - b.r * 0.5, 1, 1);
      }
    }
  }

  private drawMotes() {
    const { ctx } = this;
    if (!this.seeker || !this.talkTo) return;
    ctx.fillStyle = CYAN;
    for (const m of this.motes) {
      const a = m.from === 'you' ? this.seeker : this.talkTo;
      const b = m.to === 'you' ? this.seeker : this.talkTo;
      const x = a.x + (b.x - a.x) * m.t;
      const y = a.y + (b.y - a.y) * m.t - Math.sin(m.t * Math.PI) * 18;
      ctx.globalAlpha = Math.sin(m.t * Math.PI);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  private drawSwimmer(f: Swimmer) {
    const { ctx } = this;
    const sp = Math.hypot(f.vx, f.vy);
    drawFishBody(ctx, {
      x: f.x, y: f.y, heading: f.heading, phase: f.phase, len: f.len, speed: sp, color: f.color,
      kind: f.kind, asleep: f.status === 'away' && !f.hooked, blink: f.blink, struggle: f.struggle,
    });
    if (f.kind !== 'twin') return;
    if (f.status === 'focus' && !f.hooked) {
      // Do not disturb: a slow dashed octagon and a red dot. The twin answers instead.
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(this.time * 0.15);
      ctx.strokeStyle = 'rgba(244,244,240,0.4)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        const r = f.len * 0.72;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(f.x + f.len * 0.5, f.y - f.len * 0.5, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (f.status === 'away' && !f.hooked) {
      // Sleeping: small "z" marks drifting up.
      ctx.fillStyle = SLATE;
      ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
      const u = (this.time * 0.4) % 1;
      ctx.globalAlpha = 1 - u;
      ctx.fillText('z', f.x + 22, f.y - 14 - u * 18);
      ctx.globalAlpha = 1;
    }
  }

  private drawHoverLabel() {
    const f = this.hovered ? this.fishById(this.hovered) : undefined;
    if (!f) return;
    const { ctx } = this;
    const x = f.x;
    const y = f.y - f.len * 0.75;
    ctx.textAlign = 'center';
    ctx.font = '18px "Instrument Serif", Georgia, serif';
    ctx.fillStyle = INK;
    ctx.fillText(f.name, x, y - 14);
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = SLATE;
    ctx.fillText(`${f.role.toUpperCase()} · ${f.label.toUpperCase()}`, x, y);
    ctx.fillText('CLICK TO ASK', x, y + 13);
    ctx.textAlign = 'left';
  }
}
