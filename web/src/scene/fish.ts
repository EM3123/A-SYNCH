// Fish drawing. Anatomy follows a carangiform swimmer: a rounded head, a body that bends in a
// wave whose amplitude grows toward the tail, a narrow peduncle, and a forked caudal fin.
// Everything is cream ink on navy, with the person's accent used sparingly for identity.

export const INK = '#F4F4F0';
export const NAVY = '#030F18';
export const CYAN = '#00A9F4';
export const RED = '#D71921';
export const SLATE = '#8A99AE';

export interface FishPose {
  x: number;
  y: number;
  heading: number; // radians, direction of travel
  phase: number; // tail-beat phase
  len: number;
  speed: number;
  color: string;
  kind: 'twin' | 'seeker';
  asleep?: boolean;
  blink?: number; // 0..1, 1 = eye closed
  struggle?: number; // 0..1, extra thrashing while hooked
}

export function tint(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number, d: number) => Math.round(c * amt + d * (1 - amt));
  return `rgb(${mix(r, 3)},${mix(g, 15)},${mix(b, 24)})`;
}

// Half-width of the body at s (0 = snout, 1 = tail base). Rounded nose, deepest near a third
// of the length, tapering to a narrow peduncle.
function halfWidth(s: number, depth: number): number {
  const w = depth * 3 * (1.2 * Math.sqrt(s) - 1.1 * s);
  return Math.max(depth * 0.07, w);
}

export function drawFishBody(ctx: CanvasRenderingContext2D, p: FishPose) {
  const L = p.len;
  const depth = L * 0.2;
  const segs = 16;
  const swim = p.asleep ? 0.25 : 1;
  const amp = L * (0.045 + Math.min(0.03, p.speed * 0.0008)) * swim + (p.struggle ?? 0) * L * 0.08;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.heading);
  // Keep the belly down when swimming left.
  if (Math.cos(p.heading) < 0) ctx.scale(1, -1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Spine in local space, snout at +x. The bend travels from head to tail.
  const sx: number[] = [];
  const sy: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    sx.push((0.5 - s) * L);
    sy.push(Math.sin(p.phase - s * Math.PI * 1.6) * amp * (0.12 + 0.88 * s * s));
  }
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    const w = halfWidth(Math.max(0.001, s), depth);
    top.push([sx[i], sy[i] - w]);
    bot.push([sx[i], sy[i] + w * 0.92]);
  }

  const body = p.kind === 'seeker' ? NAVY : tint(p.color, 0.22);
  const finFill = p.kind === 'seeker' ? NAVY : tint(p.color, 0.38);

  // Tail angle from the last spine segment, so the caudal fin follows the bend.
  const tx = sx[segs];
  const ty = sy[segs];
  const ta = Math.atan2(sy[segs] - sy[segs - 2], sx[segs] - sx[segs - 2]);
  const c = Math.cos(ta);
  const sn = Math.sin(ta);
  const rot = (u: number, v: number): [number, number] => [tx - (u * c - v * sn), ty - (u * sn + v * c)];

  // Caudal fin: two curved lobes and a forked notch, with rays.
  const up = rot(L * 0.3, -L * 0.24);
  const lo = rot(L * 0.3, L * 0.24);
  const notch = rot(L * 0.17, 0);
  const upC = rot(L * 0.12, -L * 0.2);
  const loC = rot(L * 0.12, L * 0.2);
  ctx.beginPath();
  ctx.moveTo(tx, ty - depth * 0.08);
  ctx.quadraticCurveTo(upC[0], upC[1], up[0], up[1]);
  ctx.quadraticCurveTo(notch[0] + (up[0] - notch[0]) * 0.2, notch[1] - depth * 0.1, notch[0], notch[1]);
  ctx.quadraticCurveTo(notch[0] + (lo[0] - notch[0]) * 0.2, notch[1] + depth * 0.1, lo[0], lo[1]);
  ctx.quadraticCurveTo(loC[0], loC[1], tx, ty + depth * 0.08);
  ctx.closePath();
  ctx.fillStyle = finFill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 0.7;
  for (const f of [0.35, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + (up[0] - tx) * f, ty + (up[1] - ty) * f);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + (lo[0] - tx) * f, ty + (lo[1] - ty) * f);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Dorsal fin: rises behind the head, with rays.
  const d0 = 5;
  const d1 = 10;
  const peak = depth * 1.05;
  ctx.beginPath();
  ctx.moveTo(top[d0][0], top[d0][1]);
  ctx.quadraticCurveTo(top[d0 + 1][0], top[d0 + 1][1] - peak, top[d0 + 3][0], top[d0 + 3][1] - peak * 0.75);
  ctx.quadraticCurveTo(top[d1 - 1][0], top[d1 - 1][1] - peak * 0.3, top[d1][0], top[d1][1]);
  ctx.closePath();
  ctx.fillStyle = finFill;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 0.7;
  for (let i = d0 + 1; i < d1; i++) {
    const k = 1 - Math.abs(i - (d0 + 2)) / (d1 - d0);
    ctx.beginPath();
    ctx.moveTo(top[i][0], top[i][1]);
    ctx.lineTo(top[i][0] + 2, top[i][1] - peak * 0.85 * k);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Anal fin, small, near the tail
  ctx.beginPath();
  ctx.moveTo(bot[10][0], bot[10][1]);
  ctx.quadraticCurveTo(bot[11][0], bot[11][1] + depth * 0.55, bot[13][0], bot[13][1]);
  ctx.closePath();
  ctx.fillStyle = finFill;
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Body outline, smoothed through the midpoints
  ctx.beginPath();
  ctx.moveTo(sx[0] + depth * 0.05, sy[0]);
  for (let i = 1; i < top.length; i++) {
    const [ax, ay] = top[i - 1];
    const [bx, by] = top[i];
    ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
  }
  ctx.lineTo(tx, ty);
  for (let i = bot.length - 1; i > 0; i--) {
    const [ax, ay] = bot[i];
    const [bx, by] = bot[i - 1];
    ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
  }
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Identity bands in the person's accent
  if (p.kind === 'twin') {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    for (const i of [6, 8]) {
      ctx.beginPath();
      ctx.moveTo(top[i][0], top[i][1] + 1.5);
      ctx.quadraticCurveTo(sx[i] - 3, sy[i], bot[i][0], bot[i][1] - 1.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Lateral line
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(sx[4], sy[4] - depth * 0.15);
  for (let i = 5; i <= 13; i++) ctx.lineTo(sx[i], sy[i] - depth * 0.08);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Gill cover
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(sx[3] + 1, top[3][1] + depth * 0.25);
  ctx.quadraticCurveTo(sx[3] - depth * 0.35, sy[3], sx[3] + 1, bot[3][1] - depth * 0.25);
  ctx.stroke();

  // Pectoral fin, beating
  const pa = Math.sin(p.phase * 1.4) * 0.5 * swim - 0.4;
  ctx.save();
  ctx.translate(sx[4], sy[4] + depth * 0.25);
  ctx.rotate(Math.PI + pa);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(L * 0.1, -depth * 0.35, L * 0.16, 0);
  ctx.quadraticCurveTo(L * 0.1, depth * 0.2, 0, 0);
  ctx.fillStyle = finFill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Eye: closed when asleep or blinking
  const ex = sx[2] + 1;
  const ey = sy[2] - depth * 0.28;
  const er = L * 0.05;
  const closed = p.asleep || (p.blink ?? 0) > 0.5;
  if (closed) {
    ctx.beginPath();
    ctx.moveTo(ex - er, ey);
    ctx.quadraticCurveTo(ex, ey + er * 0.8, ex + er, ey);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + er * 0.25, ey, er * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = NAVY;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + er * 0.45, ey - er * 0.3, er * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }

  // Mouth
  ctx.beginPath();
  ctx.moveTo(sx[0] + depth * 0.05, sy[0] + depth * 0.06);
  ctx.lineTo(sx[0] - depth * 0.25, sy[0] + depth * 0.12);
  ctx.lineWidth = 1;
  ctx.stroke();

  // The user's fish carries a lantern lure: a bent stalk and a glowing bulb.
  if (p.kind === 'seeker') {
    const bx = sx[1] + L * 0.22;
    const by = sy[1] - depth * 1.5;
    ctx.beginPath();
    ctx.moveTo(sx[2], top[2][1]);
    ctx.quadraticCurveTo(sx[1] + L * 0.05, by - depth * 0.6, bx, by);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, L * 0.22);
    g.addColorStop(0, 'rgba(0,169,244,0.55)');
    g.addColorStop(1, 'rgba(0,169,244,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, L * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fillStyle = CYAN;
    ctx.fill();
  }

  ctx.restore();
}

// A tiny silhouette for distant schools. Cheap: an almond and a tail.
export function drawTinyFish(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, phase: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  if (Math.cos(heading) < 0) ctx.scale(1, -1);
  const wag = Math.sin(phase) * size * 0.25;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.quadraticCurveTo(0, -size * 0.45, -size * 0.8, 0);
  ctx.quadraticCurveTo(0, size * 0.45, size, 0);
  ctx.moveTo(-size * 0.7, 0);
  ctx.lineTo(-size * 1.35, -size * 0.4 + wag);
  ctx.lineTo(-size * 1.35, size * 0.4 + wag);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
