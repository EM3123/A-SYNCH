// Canvas drawing for the A-Synch ocean. Every element is hand-inked: cream strokes
// on flat navy, a little wobble, no boxes. Drawing reads simulation state and never changes it.
import { WATER, type Fish, type Stalk, type Bubble, type Pop, type Vec } from './world';

export const INK = '#F4F4F0';
export const NAVY = '#030F18';
export const CYAN = '#00A9F4';
export const RED = '#D71921';
export const SLATE = '#8A99AE';
const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

export interface Hit { x: number; y: number; r: number; kind: 'fish' | 'frond'; id: string }

// Tint navy toward a species color. Used for fish bodies: navy with a hint of the twin's hue.
export function tint(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number, d: number) => Math.round(c * amt + d * (1 - amt));
  return `rgb(${mix(r, 3)},${mix(g, 15)},${mix(b, 24)})`;
}

function rand(seed: number) {
  const s = Math.sin(seed * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

// ---- Background ----

export function drawWater(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number, t: number, calm: number) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  // Faint dot grid, pinned to the world so it slides with the camera.
  ctx.fillStyle = 'rgba(100,116,139,0.14)';
  const step = 28;
  const x0 = Math.floor(camX / step) * step;
  for (let x = x0; x < camX + W + step; x += step) {
    for (let y = step; y < H; y += step) ctx.fillRect(x - camX, y, 1.2, 1.2);
  }
  // Waterline: a thin hairline that undulates gently.
  const wy = H * WATER;
  ctx.strokeStyle = 'rgba(244,244,240,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let sx = 0; sx <= W; sx += 8) {
    const wx = sx + camX;
    const y = wy + Math.sin(wx * 0.006 + t * 0.6 * calm) * 3;
    if (sx === 0) ctx.moveTo(sx, y);
    else ctx.lineTo(sx, y);
  }
  ctx.stroke();
}

// ---- Coral outcrops: branching ink coral with a breathing dot-matrix ring ----

export function drawCoral(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number, t: number, calm: number) {
  // Ring of dots, radius R(i,t) = R0 + 0.8 sin(2t + i*2π/N), per the spec.
  const N = 56;
  const rx = 120, ry = 26;
  for (let i = 0; i < N; i++) {
    const th = (i * 2 * Math.PI) / N;
    const R = 1.1 + 0.8 * Math.sin(2 * t * calm + (i * 2 * Math.PI) / N);
    ctx.beginPath();
    ctx.arc(x + Math.cos(th) * rx, y + Math.sin(th) * ry, Math.max(0.3, R), 0, Math.PI * 2);
    ctx.fillStyle = i % 7 === 0 ? CYAN : 'rgba(244,244,240,0.45)';
    ctx.fill();
  }
  // Mound
  ctx.beginPath();
  ctx.ellipse(x, y, 46, 12, 0, Math.PI, 0, false);
  ctx.fillStyle = NAVY;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const branch = (x0: number, y0: number, ang: number, len: number, depth: number, k: number) => {
    const j = (rand(seed * 7 + depth * 31 + k) - 0.5) * 0.35;
    const x1 = x0 + Math.cos(ang + j) * len;
    const y1 = y0 - Math.sin(ang + j) * len;
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.6 + depth * 0.35;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (depth === 0) {
      ctx.beginPath();
      ctx.arc(x1, y1, 1.6 + 0.6 * Math.sin(2 * t * calm + seed), 0, Math.PI * 2);
      ctx.fillStyle = CYAN;
      ctx.fill();
      return;
    }
    branch(x1, y1, ang + 0.5, len * 0.72, depth - 1, k * 2 + 1);
    branch(x1, y1, ang - 0.5, len * 0.72, depth - 1, k * 2 + 2);
  };
  branch(x, y - 4, Math.PI / 2 - 0.25, 32, 3, 1);
  branch(x, y - 4, Math.PI / 2 + 0.25, 30, 3, 2);
}

// ---- Kelp ----

export function drawKelp(ctx: CanvasRenderingContext2D, s: Stalk, leaves: boolean) {
  const p = s.pts;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
  }
  ctx.stroke();
  if (leaves) {
    for (let i = 2; i < p.length; i += 2) {
      const d = i % 4 === 0 ? 1 : -1;
      const q = p[i];
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.quadraticCurveTo(q.x + d * 26, q.y - 14, q.x + d * 44, q.y - 36);
      ctx.quadraticCurveTo(q.x + d * 24, q.y - 6, q.x, q.y);
      ctx.fillStyle = NAVY;
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// ---- Bubbles ----

export function drawBubbles(ctx: CanvasRenderingContext2D, bubbles: Bubble[], pops: Pop[]) {
  ctx.fillStyle = CYAN;
  for (const b of bubbles) {
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of pops) {
    ctx.globalAlpha = Math.max(0, 1 - p.age / 0.5);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(p.x + p.dx[i] * (p.age * 4), p.y + p.dy[i] * (p.age * 4), 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---- Fish: a body that bends in a traveling wave, like a real swimmer ----

export function drawFish(ctx: CanvasRenderingContext2D, f: Fish, showLabel: boolean, selected: boolean) {
  const L = f.kind === 'seeker' ? 66 : 58;
  const facing = f.vel.x < -0.5 ? -1 : 1;
  const asleep = f.status === 'away';
  const amp = asleep ? 0.8 : 4.5;
  const body = f.kind === 'seeker' ? NAVY : tint(f.color, 0.3);
  const segs = 12;
  const hw = (s: number) => 13 * Math.pow(Math.sin(Math.PI * (0.02 + 0.5 * (1 - s))), 0.8);

  ctx.save();
  ctx.translate(f.pos.x, f.pos.y);
  ctx.scale(facing, 1);
  ctx.globalAlpha = asleep ? 0.5 : 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Spine: head at +x, the bend grows toward the tail.
  const spine: Vec[] = [];
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    spine.push({ x: (0.5 - s) * L, y: Math.sin(f.phase - s * Math.PI * 1.3) * amp * s * s });
  }

  // Tail fin, wagging on the last spine point.
  const tail = spine[segs];
  const wag = Math.sin(f.phase * 1.2 - Math.PI * 1.3) * 4;
  ctx.beginPath();
  ctx.moveTo(tail.x + 2, tail.y);
  ctx.lineTo(tail.x - 14, tail.y - 12 + wag);
  ctx.lineTo(tail.x - 8, tail.y);
  ctx.lineTo(tail.x - 14, tail.y + 12 + wag);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Dorsal fin
  ctx.beginPath();
  ctx.moveTo(spine[3].x + 4, spine[3].y - hw(0.25));
  ctx.quadraticCurveTo((spine[4].x + spine[7].x) / 2, spine[4].y - 18, spine[7].x, spine[7].y - hw(0.58));
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // Body outline
  ctx.beginPath();
  spine.forEach((p, i) => {
    const h = hw(i / segs);
    if (i === 0) ctx.moveTo(p.x, p.y - h);
    else ctx.lineTo(p.x, p.y - h);
  });
  for (let i = segs; i >= 0; i--) ctx.lineTo(spine[i].x, spine[i].y + hw(i / segs));
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Pectoral fin, beating
  const a = Math.sin(f.phase * 2) * 0.4;
  ctx.beginPath();
  ctx.moveTo(spine[2].x, spine[2].y);
  ctx.lineTo(spine[2].x - 10 * Math.cos(a), spine[2].y + 8 + 6 * Math.sin(a));
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Species stripes
  if (f.kind === 'twin') {
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 1.4;
    for (const i of [4, 6]) {
      const h = hw(i / segs) * 0.9;
      ctx.beginPath();
      ctx.moveTo(spine[i].x, spine[i].y - h);
      ctx.quadraticCurveTo(spine[i].x - 3, spine[i].y, spine[i].x, spine[i].y + h);
      ctx.stroke();
    }
  }

  // Eye and mouth port
  ctx.beginPath();
  ctx.arc(spine[1].x, spine[1].y - 2, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(spine[1].x + 0.5, spine[1].y - 2.2, 1.1, 0, Math.PI * 2);
  ctx.fillStyle = NAVY;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(spine[0].x - 1, spine[0].y, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = f.kind === 'seeker' ? CYAN : f.color;
  ctx.fill();

  // Seeker's bioluminescent lure
  if (f.kind === 'seeker') {
    ctx.beginPath();
    ctx.moveTo(spine[1].x, spine[1].y - 4);
    ctx.quadraticCurveTo(spine[1].x + 4, spine[1].y - 22, spine[1].x + 18, spine[1].y - 24);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(spine[1].x + 18, spine[1].y - 24, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = CYAN;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();

  // Overlays drawn in world space, unaffected by facing.
  if (f.status === 'focus') {
    // Deep-work shield: a slow dashed octagon and a red indicator. The twin answers instead of the human.
    ctx.save();
    ctx.translate(f.pos.x, f.pos.y);
    ctx.rotate(Math.sin(f.phase * 0.05) * 0.05);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const th = (i * Math.PI) / 4 + Math.PI / 8;
      const r = 46;
      const px = Math.cos(th) * r;
      const py = Math.sin(th) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(244,244,240,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(34, -34, 4, 0, Math.PI * 2);
    ctx.fillStyle = RED;
    ctx.fill();
    ctx.restore();
  }

  if (selected) {
    ctx.beginPath();
    ctx.arc(f.pos.x, f.pos.y, 52, 0, Math.PI * 2);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (showLabel) {
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText(`${f.id}.twin`.toUpperCase(), f.pos.x, f.pos.y - 44);
    ctx.fillStyle = SLATE;
    const label = f.status === 'available' ? 'AVAILABLE' : f.status === 'focus' ? 'DEEP WORK · TWIN ANSWERS' : 'AWAY · TWIN ACTIVE';
    ctx.fillText(label, f.pos.x, f.pos.y - 31);
    ctx.textAlign = 'left';
  }
}

// ---- Boat and fishing line ----

export function drawBoat(ctx: CanvasRenderingContext2D, x: number, waterY: number, lantern: boolean, t: number, calm: number) {
  const bob = Math.sin(t * 1.2 * calm) * 1.5;
  ctx.save();
  ctx.translate(x - 110, waterY - 85 + bob);
  ctx.strokeStyle = INK;
  ctx.fillStyle = NAVY;
  ctx.lineWidth = 1.7;
  ctx.lineJoin = 'round';
  // Hull
  ctx.beginPath();
  ctx.moveTo(32, 66);
  ctx.bezierCurveTo(65, 69, 115, 69, 152, 64);
  ctx.lineTo(138, 84);
  ctx.bezierCurveTo(105, 87, 62, 87, 44, 83);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Angler, sitting
  ctx.beginPath();
  ctx.arc(88, 36, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(76, 68);
  ctx.bezierCurveTo(75, 52, 82, 44, 91, 45);
  ctx.bezierCurveTo(98, 46, 102, 55, 100, 68);
  ctx.fill();
  ctx.stroke();
  // Rod
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(98, 55);
  ctx.quadraticCurveTo(148, 22, 205, 32);
  ctx.stroke();
  // Lantern lights up while typing
  ctx.beginPath();
  ctx.moveTo(28, 58);
  ctx.lineTo(22, 44);
  ctx.lineTo(34, 44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(28, 50, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = lantern ? CYAN : SLATE;
  if (lantern) {
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 10;
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  return { x: x - 110 + 205, y: waterY - 85 + bob + 32 };
}

export function drawHookAndLine(
  ctx: CanvasRenderingContext2D,
  rod: Vec,
  hook: Vec,
  tension: number,
  scanning: boolean,
  t: number,
) {
  // Catenary sag while slack; straightens with a damped wobble when taut.
  const midX = (rod.x + hook.x) / 2;
  const midY = (rod.y + hook.y) / 2;
  const sag = (1 - tension) * 40;
  const wob = tension > 0.9 ? Math.sin(t * 30) * 0.6 : 0;
  ctx.beginPath();
  ctx.moveTo(rod.x, rod.y);
  ctx.quadraticCurveTo(midX + wob, midY + sag, hook.x, hook.y);
  ctx.strokeStyle = tension > 0.9 ? CYAN : INK;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = tension > 0.9 ? 1.2 : 1;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Hook, state A (descending) with taut tension on the eyelet when reeling.
  ctx.save();
  ctx.translate(hook.x, hook.y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 3);
  ctx.lineTo(0, 27);
  ctx.bezierCurveTo(0, 39, -14, 39, -14, 26);
  ctx.bezierCurveTo(-14, 21, -11, 18, -8, 16);
  ctx.stroke();
  ctx.restore();

  if (scanning) {
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    for (const r of [14, 22]) {
      ctx.beginPath();
      ctx.arc(hook.x, hook.y + 27, r + (Math.sin(t * 3) + 1) * 2, 0, Math.PI * 2);
      ctx.setLineDash(r === 14 ? [2, 3] : [1, 5]);
      ctx.globalAlpha = 0.6;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}

// ---- Seaweed farm: vertical kelp spine, fronds attached left and right ----

export interface Frond {
  id: string;
  side: 'left' | 'right';
  kind: 'prompt' | 'diff' | 'pruned';
  label: string;
  detail: string;
}

export function drawFarm(
  ctx: CanvasRenderingContext2D,
  spine: Stalk,
  fronds: Frond[],
  root: string,
  owner: string,
  title: { x: number; y: number },
  t: number,
  calm: number,
  hits: Hit[],
) {
  // Title, quiet and editorial
  ctx.fillStyle = INK;
  ctx.font = `28px ${SERIF}`;
  ctx.fillText(`Workflow plot · ${owner}`, title.x, title.y);
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = SLATE;
  ctx.fillText('TOP = ORIGIN · TIME FLOWS DOWN · LEFT = REASONING · RIGHT = ARTIFACTS', title.x, title.y + 22);

  // Kelp spine (Verlet chain, pinned at the top suspension point)
  drawKelp(ctx, spine, false);

  // Root bulb at the top
  const top = spine.pts[0];
  ctx.beginPath();
  ctx.arc(top.x, top.y + 14, 9, 0, Math.PI * 2);
  ctx.fillStyle = NAVY;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.fillText(`[ROOT] ${root}`, top.x + 18, top.y + 18);

  fronds.forEach((f, i) => {
    const attach = spine.pts[Math.min(spine.pts.length - 1, 3 + i * 4)];
    const d = f.side === 'left' ? -1 : 1;
    const tipX = attach.x + d * 150;
    const tipY = attach.y + 52;
    const pruned = f.kind === 'pruned';

    ctx.save();
    ctx.strokeStyle = pruned ? SLATE : INK;
    ctx.fillStyle = f.kind === 'diff' ? 'rgba(244,244,240,0.06)' : NAVY;
    ctx.lineWidth = 1.5;
    if (pruned) ctx.setLineDash([3, 4]);
    // Stem
    ctx.beginPath();
    ctx.moveTo(attach.x, attach.y);
    ctx.quadraticCurveTo(attach.x + d * 60, attach.y + 4, tipX, tipY);
    ctx.stroke();
    // Blade: a soft leaf with a midrib
    // Leaf: two curved edges meet at the tip, swaying a little with the current.
    const sway = Math.sin(t * 0.8 * calm + i) * 3;
    ctx.beginPath();
    ctx.moveTo(attach.x, attach.y);
    ctx.bezierCurveTo(attach.x + d * 50, attach.y - 26 + sway, tipX - d * 30, tipY - 30 + sway, tipX, tipY);
    ctx.bezierCurveTo(tipX - d * 30, tipY + 22 + sway, attach.x + d * 50, attach.y + 26 + sway, attach.x, attach.y);
    ctx.closePath();
    ctx.fill();
    // Midrib
    ctx.beginPath();
    ctx.moveTo(attach.x + d * 6, attach.y);
    ctx.quadraticCurveTo(attach.x + d * 80, attach.y + sway, tipX, tipY);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.stroke();
    ctx.restore();

    // Floating label, no box
    ctx.font = `11px ${MONO}`;
    ctx.fillStyle = pruned ? SLATE : INK;
    ctx.textAlign = d < 0 ? 'right' : 'left';
    ctx.fillText(f.label, tipX + d * 8, tipY - 4);
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = SLATE;
    ctx.fillText(f.detail, tipX + d * 8, tipY + 12);
    ctx.textAlign = 'left';

    hits.push({ x: tipX, y: tipY, r: 40, kind: 'frond', id: f.id });
  });

  // Growing tip at the bottom: live work pulses cyan
  const bottom = spine.pts[spine.pts.length - 1];
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(bottom.x + (i - 1.5) * 6, bottom.y + 6 + (i % 2) * 4, 1.4 + Math.sin(t * 3 * calm + i) * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = i < 2 ? CYAN : INK;
    ctx.fill();
  }
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = SLATE;
  ctx.fillText('LIVE // GROWING TIP', bottom.x + 14, bottom.y + 10);
}

// Caught fish label: floating text, no box
export function drawCaught(ctx: CanvasRenderingContext2D, at: Vec, name: string, role: string, match: number, reason: string) {
  ctx.fillStyle = INK;
  ctx.font = `22px ${SERIF}`;
  ctx.fillText(`${name} — ${role}`, at.x, at.y);
  ctx.font = `11px ${MONO}`;
  ctx.fillStyle = CYAN;
  ctx.fillText(`${match}% CONTEXT MATCH`, at.x, at.y + 20);
  ctx.fillStyle = SLATE;
  ctx.fillText(reason, at.x, at.y + 36);
}

