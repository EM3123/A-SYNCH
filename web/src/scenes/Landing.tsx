// Landing: a dot-matrix wave crashes into the boat. Ask the team and the line dives to hook the
// people the backend selected, one at a time. Ask one person and your twin swims to their coral.
// The answer itself is text on the page: label, claims, sources, conflicts, next steps.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { askPerson, askTeam, availabilityToStatus, type AskResponse, type PersonProfile } from '../api';
import { outcropFor } from '../data';
import { WATER, reefHomes, type Fish, type Vec } from '../sim/world';
import { drawBoat, drawHookAndLine, drawFish, drawCoral, INK, CYAN } from '../sim/draw';
import ResultPanel from './ResultPanel';

export type Mode = 'team' | 'person';

// Prompts from the teammate's handoff doc. They are the guaranteed demo questions.
export const DEMO_QUESTIONS = [
  'Can we ship Atlas today?',
  'Would Priya support a 10% beta rollout today?',
  'Approve the Atlas launch for me.',
];

// The requester is the demo user from the backend (lib/agents/demo-context.ts).
export const REQUESTER_ID = 'daksh';

const SPACING = 13;
const HISTORY_KEY = 'asynch.history';

type Step = { kind: 'hook'; id: string } | { kind: 'swim'; id: string };

interface Props {
  roster: PersonProfile[];
  reduceMotion: boolean;
  motionOn: boolean;
  onToggleMotion: () => void;
  onEnter: () => void;
  onResponse: (r: AskResponse | null) => void;
}

function loadHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: string[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    // Storage can be blocked. History is a convenience, so the app keeps working.
  }
}

// Height of the wave surface at x, given the crest position. The front steepens toward the boat.
function waveH(x: number, crest: number, t: number): number {
  const d = x - crest;
  const front = d < 0 ? Math.exp(-(d * d) / (2 * 70 * 70)) : 0.6 * Math.exp(-(d * d) / (2 * 110 * 110));
  return Math.max(0, front + 0.1 * Math.sin(x * 0.02 + t * 1.4));
}

export default function Landing({ roster, reduceMotion, motionOn, onToggleMotion, onEnter, onResponse }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('team');
  const [personId, setPersonId] = useState<string>('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [copied, setCopied] = useState('');
  const motionRef = useRef(reduceMotion);
  const rosterRef = useRef(roster);
  const plan = useRef<{ searching: boolean; steps: Step[] }>({ searching: false, steps: [] });

  useEffect(() => { motionRef.current = reduceMotion; }, [reduceMotion]);
  useEffect(() => { rosterRef.current = roster; }, [roster]);
  useEffect(() => {
    if (!personId && roster.length) setPersonId(roster[0].id);
  }, [roster, personId]);
  useEffect(() => { onResponse(response); }, [response, onResponse]);

  // "/" focuses the question, Escape clears the result.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && !typing) {
        setResponse(null);
        setError(null);
        setQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Canvas and animation loop, set up once.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let dpr = 1;
    let W = 0;
    let H = 0;
    let raf = 0;
    let last = performance.now();
    let impulse = 0;
    let prevCrest = 0;
    const foam: { x: number; y: number; vx: number; vy: number; age: number }[] = [];
    let sprites = new Map<string, Fish>();
    let you: Fish | null = null;
    let corals: Record<string, Vec> = {};
    // Current step state
    let stepT0 = 0;
    let sub: 'dive' | 'search' | 'bite' | 'reel' | 'release' | 'swim' | 'tether' | 'back' | 'idle' = 'idle';
    let hook: Vec = { x: 0, y: 0 };
    let tension = 0;
    let active: Step | null = null;

    const build = () => {
      const homes = reefHomes(W, H);
      corals = homes as unknown as Record<string, Vec>;
      const m = new Map<string, Fish>();
      rosterRef.current.forEach((p, i) => {
        const home = homes[outcropFor(p.id)];
        m.set(p.id, {
          id: p.id, name: p.name, role: p.role, color: p.accent, status: availabilityToStatus(p.availability),
          kind: 'twin', home: { ...home }, pos: { x: home.x + (i % 3) * 40 - 40, y: home.y - 50 - (i % 2) * 24 },
          vel: { x: i % 2 ? 6 : -6, y: 0 }, phase: i, hooked: false,
        });
      });
      sprites = m;
      you = {
        id: 'you', name: 'You', role: '', color: CYAN, status: 'available', kind: 'seeker',
        home: { x: W * 0.12, y: H * WATER + 40 }, pos: { x: W * 0.12, y: H * WATER + 40 }, vel: { x: 1, y: 0 }, phase: 0, hooked: false,
      };
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      build();
    };
    resize();
    window.addEventListener('resize', resize);

    const boatX = () => W * 0.3;
    const waterY = () => H * WATER;
    const crestAt = (t: number) => W * 1.2 - ((t * 90) % (W * 1.6));

    // Start the next queued step, or stop.
    const next = (now: number) => {
      const p = plan.current;
      if (p.steps.length === 0) {
        active = null;
        sub = 'idle';
        return;
      }
      active = p.steps.shift()!;
      stepT0 = now;
      sub = active.kind === 'hook' ? 'dive' : 'swim';
    };

    (canvas as HTMLCanvasElement & { refresh?: () => void }).refresh = build;
    (canvas as HTMLCanvasElement & { kick?: () => void }).kick = () => next(performance.now());

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const calm = motionRef.current ? 0 : 1;
      const wy = waterY();
      const bx = boatX();

      // Wave and impact on the boat
      const crest = calm ? crestAt(t) : W * 0.55;
      if (prevCrest > bx + 10 && crest <= bx + 10 && calm) {
        impulse = 1;
        for (let i = 0; i < 26; i++) {
          foam.push({ x: bx + (Math.random() - 0.2) * 30, y: wy + 6, vx: -20 + Math.random() * 80, vy: -140 + Math.random() * 90, age: 0 });
        }
      }
      prevCrest = crest;
      impulse = Math.max(0, impulse - dt * 1.5);
      for (let i = foam.length - 1; i >= 0; i--) {
        const f = foam[i];
        f.age += dt;
        f.vy += 220 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.age > 0.9) foam.splice(i, 1);
      }

      // Boat tilt and rod tip
      const tilt = calm * (Math.sin(t * 1.2) * 0.03 + impulse * 0.1 * Math.sin(t * 14));
      const rodLocal = { x: bx + 95, y: wy - 53 };
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      const rod: Vec = {
        x: bx + (rodLocal.x - bx) * cos - (rodLocal.y - wy) * sin,
        y: wy + (rodLocal.x - bx) * sin + (rodLocal.y - wy) * cos,
      };

      // Step machine. "Searching" loops while the request is out, then queued steps play.
      if (!active && plan.current.searching) {
        active = { kind: 'hook', id: '' };
        stepT0 = now;
        sub = 'search';
      }
      const el = (now - stepT0) / 1000;
      const target = active && active.kind === 'hook' && active.id ? sprites.get(active.id) : undefined;
      const swimTo = active && active.kind === 'swim' ? sprites.get(active.id) : undefined;

      if (active) {
        if (active.kind === 'hook') {
          const home = target ? target.home : { x: W * 0.5, y: H * 0.8 };
          if (sub === 'search') {
            const k = Math.min(1, el / 1.8);
            hook = { x: home.x + Math.sin(el * 2.2) * 40 * k, y: H * 0.8 + Math.sin(el * 3) * 8 };
            tension = 0.2;
            if (!plan.current.searching && k >= 1) { active = null; sub = 'idle'; }
            else if (k >= 1) { stepT0 = now; }
            if (!plan.current.searching && active === null) next(now);
          } else if (sub === 'dive') {
            const k = Math.min(1, el / 1.2);
            const e = 1 - Math.pow(1 - k, 3);
            hook = { x: rod.x + (home.x - rod.x) * e, y: rod.y + (H * 0.8 - rod.y) * e };
            tension = 0.15;
            if (k >= 1) { sub = 'bite'; stepT0 = now; }
          } else if (sub === 'bite') {
            tension = 0.7;
            if (target) target.hooked = true;
            if (el > 0.4) { sub = 'reel'; stepT0 = now; }
          } else if (sub === 'reel') {
            const k = Math.min(1, el / 1.0);
            const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            const from = { x: home.x, y: H * 0.8 };
            hook = { x: from.x + (bx + 10 - from.x) * e, y: from.y + (wy + 36 - from.y) * e };
            tension = 1;
            if (target) { target.pos.x = hook.x; target.pos.y = hook.y + 14; }
            if (k >= 1) { sub = 'release'; stepT0 = now; }
          } else if (sub === 'release') {
            tension = 0.4;
            if (target) target.hooked = false;
            if (el > 0.3) next(now);
          }
        } else if (active.kind === 'swim' && swimTo) {
          const home = swimTo.home;
          const a = { x: bx + 120, y: wy + 30 };
          const c = { x: W * 0.46, y: H * 0.62 };
          const b = { x: home.x - 60, y: home.y - 22 };
          if (sub === 'swim') {
            const k = Math.min(1, el / 2.2);
            const e = 1 - Math.pow(1 - k, 2);
            you!.pos.x = (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * c.x + e * e * b.x;
            you!.pos.y = (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * c.y + e * e * b.y;
            you!.vel.x = b.x - a.x;
            if (k >= 1) { sub = 'tether'; stepT0 = now; }
          } else if (sub === 'tether') {
            if (el > 1.2) { sub = 'back'; stepT0 = now; }
          } else if (sub === 'back') {
            const k = Math.min(1, el / 1.0);
            const e = 1 - Math.pow(1 - k, 2);
            you!.pos.x = b.x + (a.x - b.x) * e;
            you!.pos.y = b.y + (a.y - b.y) * e;
            you!.vel.x = a.x - b.x;
            if (k >= 1) next(now);
          }
        } else {
          next(now);
        }
      }

      // Drift resting twins a little
      sprites.forEach((f) => {
        if (!f.hooked && !(active && active.kind === 'swim' && f.id === active.id)) {
          f.pos.x = f.home.x + Math.sin(t * 0.3 + f.phase) * 6;
          f.pos.y = f.home.y + Math.sin(t * 0.7 + f.phase) * 6;
        }
      });

      // ---- Draw ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#030F18';
      ctx.fillRect(0, 0, W, H);

      for (let x = 0; x <= W; x += SPACING) {
        const h = waveH(x, crest, t);
        for (let y = wy + 8; y < H * 0.72; y += SPACING) {
          const depth = (y - wy) / (H * 0.72 - wy);
          const lift = h * 90 * (1 - depth * 0.5);
          const r = 0.6 + h * 2.4 * (1 - depth * 0.6);
          ctx.fillStyle = h > 0.35
            ? `rgba(244,244,240,${Math.min(0.95, 0.4 + h * 0.6)})`
            : `rgba(138,153,174,${0.12 + h * 0.4 + (1 - depth) * 0.08})`;
          ctx.beginPath();
          ctx.arc(x, y - lift, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = INK;
      for (const f of foam) {
        ctx.globalAlpha = Math.max(0, 1 - f.age / 0.9);
        ctx.beginPath();
        ctx.arc(f.x, f.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(244,244,240,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const y = wy + Math.sin(x * 0.006 + t * 0.6 * calm) * 3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.save();
      ctx.translate(bx, wy);
      ctx.rotate(tilt);
      ctx.translate(-bx, -wy);
      drawBoat(ctx, bx, wy, true, t, calm);
      ctx.restore();

      Object.values(corals).forEach((c, i) => drawCoral(ctx, c.x, c.y, i + 3, t, calm));

      if (active && active.kind === 'hook' && sub !== 'idle') {
        drawHookAndLine(ctx, rod, hook, tension, sub === 'search' || sub === 'dive', t);
      }

      sprites.forEach((f) => drawFish(ctx, f, false, false));

      if (active && active.kind === 'swim' && you) {
        const s = sprites.get(active.id);
        if (s && (sub === 'tether')) {
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = CYAN;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(you.pos.x, you.pos.y);
          ctx.lineTo(s.pos.x, s.pos.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        drawFish(ctx, you, false, false);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Roster changed: rebuild the sprites so names, colors, and states are current.
  useEffect(() => {
    (canvasRef.current as (HTMLCanvasElement & { refresh?: () => void }) | null)?.refresh?.();
  }, [roster]);

  // Queue the animation for a finished answer. Team mode hooks the selected people one by one.
  // Person mode swims your twin to that person's coral.
  const queueFor = (r: AskResponse): Step[] => {
    if (r.mode === 'person') {
      const id = r.selectedPeople[0]?.id ?? personId;
      return id ? [{ kind: 'swim', id }] : [];
    }
    return r.selectedPeople.slice(0, 3).map((p): Step => ({ kind: 'hook', id: p.id }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || pending) return;
    setPending(true);
    setError(null);
    setCopied('');
    plan.current.searching = true;
    try {
      const r = mode === 'team' ? await askTeam(q, REQUESTER_ID) : await askPerson(personId, q, REQUESTER_ID);
      setResponse(r);
      plan.current.searching = false;
      plan.current.steps = motionRef.current ? [] : queueFor(r);
      (canvasRef.current as (HTMLCanvasElement & { kick?: () => void }) | null)?.kick?.();
      const h = [q, ...history.filter((x) => x !== q)].slice(0, 5);
      setHistory(h);
      saveHistory(h);
    } catch (err) {
      plan.current.searching = false;
      setResponse(null);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied.');
    } catch {
      setCopied('Copy did not work. Select the text and copy it by hand.');
    }
  };

  return (
    <main className="landing">
      <canvas ref={canvasRef} className="ocean" aria-hidden="true" />

      <header className="chrome">
        <div className="brand">A-SYNCH</div>
        <div className="chrome-right">
          <button type="button" aria-pressed={motionOn} onClick={onToggleMotion}>
            Motion {motionOn ? 'on' : 'off'}
          </button>
          <button type="button" onClick={onEnter}>Enter the reef →</button>
        </div>
      </header>

      <form className="query" onSubmit={submit}>
        <label htmlFor="query-input" className="sr-only">Ask a question</label>
        <input
          id="query-input"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask the team a question…"
          autoComplete="off"
          maxLength={1000}
          aria-describedby="query-help"
        />
        <p id="query-help" className="hint">Press / to focus, Escape to clear, Enter to ask.</p>

        <div className="row">
          <div className="modes" role="group" aria-label="Who to ask">
            <button type="button" aria-pressed={mode === 'team'} onClick={() => setMode('team')}>Ask the team</button>
            <button type="button" aria-pressed={mode === 'person'} onClick={() => setMode('person')}>Ask one person</button>
          </div>
          {mode === 'person' && (
            <label className="field">
              <span>Person</span>
              <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                {roster.map((p) => <option key={p.id} value={p.id}>{p.name}, {p.role}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="row examples" aria-label="Example questions">
          {DEMO_QUESTIONS.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => { setQuery(q); inputRef.current?.focus(); }}>{q}</button>
          ))}
        </div>

        {history.length > 0 && (
          <div className="row history" aria-label="Recent questions">
            <span className="dim">Recent</span>
            {history.map((h) => (
              <button key={h} type="button" className="chip" onClick={() => { setQuery(h); inputRef.current?.focus(); }}>{h}</button>
            ))}
          </div>
        )}

        <button type="submit" className="submit" disabled={pending || !query.trim()}>
          {pending ? 'Searching the team…' : 'Ask'}
        </button>
        {copied && <p role="status" className="dim">{copied}</p>}
      </form>

      {error && (
        <section className="answer" role="alert">
          <h2 className="serif">Couldn't get an answer</h2>
          <p>{error}</p>
        </section>
      )}

      {response && (
        <ResultPanel
          response={response}
          people={roster}
          onAskAgain={() => { setResponse(null); setQuery(''); inputRef.current?.focus(); }}
          onCopy={copy}
        />
      )}

      <p className="sr-only" role="status">
        {pending ? 'Searching the team.' : response ? `${response.brief.trust.decision}. ${response.brief.answer.split('\n')[0]}` : error ?? ''}
      </p>
    </main>
  );
}
