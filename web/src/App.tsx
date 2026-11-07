// The ocean: explore the team's reef and the seaweed farm. Every fish and source is also in a
// keyboard list, so nothing depends on the mouse. The drawer opens with focus on its heading.
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import './App.css';
import { availabilityToStatus, type AskResponse, type Evidence, type PersonProfile } from './api';
import { outcropFor, outcropLabels, type OutcropId } from './data';
import { WATER, makeStalk, stepStalk, stepFish, stepBubbles, reefHomes, type Fish, type Stalk, type Bubble, type Pop, type Vec } from './sim/world';
import { drawWater, drawCoral, drawKelp, drawBubbles, drawFish, drawFarm, type Hit, type Frond } from './sim/draw';

type View = 'reef' | 'farm';
type Selection = { kind: 'person'; id: string } | { kind: 'frond'; id: string } | null;

interface Props {
  roster: PersonProfile[];
  rosterError: string | null;
  lastResponse: AskResponse | null;
  reduceMotion: boolean;
  onBack: () => void;
}

const FARM_PAD = 0.5;
const FARM_SHIFT = 0.45;
const FARM_EMPTY = 'Ask a question on the landing page to grow a plot.';

interface Sim {
  W: number;
  H: number;
  fish: Fish[];
  reefKelp: Stalk[];
  farm: Stalk;
  bubbles: Bubble[];
  pops: Pop[];
  cam: { from: number; to: number; t0: number };
  lastBubble: number;
  hits: Hit[];
}

function makeOcean(W: number, H: number, roster: PersonProfile[]): Sim {
  const homes = reefHomes(W, H);
  const fish: Fish[] = roster.map((p, i) => {
    const home = homes[outcropFor(p.id)];
    const pos: Vec = { x: home.x + (i % 3 - 1) * 46, y: home.y - 60 - (i % 2) * 34 };
    return {
      id: p.id, name: p.name, role: p.role, color: p.accent, status: availabilityToStatus(p.availability),
      kind: 'twin', home: { ...home }, pos, vel: { x: i % 2 ? 8 : -8, y: 0 }, phase: i, hooked: false,
    };
  });
  const floor = H - 30;
  const reefKelp = [
    makeStalk(W * 0.03, floor, 12, (H * 0.5) / 11, -1),
    makeStalk(W * 0.94, floor, 14, (H * 0.55) / 13, -1),
  ];
  const farm = makeStalk(W * (1 + FARM_PAD + FARM_SHIFT), H * 0.12, 22, (H * 0.8) / 21, 1);
  return {
    W, H, fish, reefKelp, farm, bubbles: [], pops: [],
    cam: { from: 0, to: 0, t0: -1e9 }, lastBubble: 0, hits: [],
  };
}

function camAt(sim: Sim, now: number): number {
  const k = Math.min(1, (now - sim.cam.t0) / 600);
  const e = 1 - Math.pow(1 - k, 3);
  return sim.cam.from + (sim.cam.to - sim.cam.from) * e;
}

// Fronds come from the sources the answer used. Chat and meeting notes go left (discussion),
// tickets and code go right (artifacts), and out-of-date sources are drawn dashed.
function frondsFrom(response: AskResponse | null): Frond[] {
  if (!response) return [];
  return response.sources.map((s: Evidence): Frond => {
    const discussion = s.sourceType === 'slack' || s.sourceType === 'meeting' || s.sourceType === 'note';
    return {
      id: s.id,
      side: discussion ? 'left' : 'right',
      kind: s.stale ? 'pruned' : discussion ? 'prompt' : 'diff',
      label: s.title,
      detail: `${s.sourceLabel} · ${s.timestamp.slice(0, 10)}`,
    };
  });
}

export default function App({ roster, rosterError, lastResponse, reduceMotion, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const motionRef = useRef(reduceMotion);
  const selectionRef = useRef<Selection>(null);
  const evidence = useMemo(() => lastResponse?.sources ?? [], [lastResponse]);
  const fronds = useMemo(() => frondsFrom(lastResponse), [lastResponse]);
  const frondRef = useRef<Frond[]>(fronds);
  const questionRef = useRef<string | null>(lastResponse?.question ?? null);
  const rosterRef = useRef(roster);
  const [view, setView] = useState<View>('reef');
  const [selection, setSelection] = useState<Selection>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const drawerHeading = useRef<HTMLHeadingElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const helpRef = useRef<HTMLDialogElement>(null);

  useEffect(() => { motionRef.current = reduceMotion; }, [reduceMotion]);
  useEffect(() => { frondRef.current = fronds; }, [fronds]);
  useEffect(() => { questionRef.current = lastResponse?.question ?? null; }, [lastResponse]);
  useEffect(() => { rosterRef.current = roster; }, [roster]);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

  // Focus moves into the drawer when it opens, and back to the trigger when it closes.
  useEffect(() => {
    if (selection) {
      drawerHeading.current?.focus();
    } else if (lastTrigger.current) {
      lastTrigger.current.focus();
      lastTrigger.current = null;
    }
  }, [selection]);

  useEffect(() => {
    const dlg = helpRef.current;
    if (!dlg) return;
    if (helpOpen && !dlg.open) dlg.showModal();
    if (!helpOpen && dlg.open) dlg.close();
  }, [helpOpen]);

  const setTargetView = (v: View) => {
    const sim = simRef.current;
    if (!sim) return;
    const now = performance.now();
    const from = camAt(sim, now);
    sim.cam = { from, to: v === 'farm' ? sim.W * (1 + FARM_PAD) : 0, t0: now };
    setView(v);
    setSelection(null);
  };

  // Keyboard: 1 and 2 switch places, ? opens shortcuts, Escape closes the drawer. Tab is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (typing) return;
      if (e.key === '1') setTargetView('reef');
      else if (e.key === '2') setTargetView('farm');
      else if (e.key === '?') setHelpOpen((v) => !v);
      else if (e.key === 'Escape') setSelection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const prev = simRef.current;
      const next = makeOcean(W, H, rosterRef.current);
      if (prev) next.cam = prev.cam;
      simRef.current = next;
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (now: number) => {
      const sim = simRef.current!;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const calm = motionRef.current ? 0 : 1;
      const { W, H } = sim;
      const waterY = H * WATER;
      const camX = camAt(sim, now);

      for (const f of sim.fish) stepFish(f, sim.fish, t, dt, W, H, calm);

      const avoid: Vec[] = sim.fish.map((f) => f.pos);
      for (const s of sim.reefKelp) stepKelp(s, t, dt, avoid, calm);
      stepKelp(sim.farm, t, dt, [], calm);

      const homes = reefHomes(W, H);
      if (calm && now - sim.lastBubble > 700) {
        sim.lastBubble = now;
        const keys = Object.keys(homes) as OutcropId[];
        const home = homes[keys[Math.floor(Math.random() * keys.length)]];
        sim.bubbles.push({ x: home.x + (Math.random() - 0.5) * 60, y: home.y - 10, age: 0 });
      }
      stepBubbles(sim.bubbles, sim.pops, waterY, dt, t, calm);

      sim.hits = [];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWater(ctx, W, H, camX, t, calm);

      ctx.save();
      ctx.translate(-camX, 0);
      ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
      (Object.entries(homes) as [OutcropId, Vec][]).forEach(([id, h], i) => {
        drawCoral(ctx, h.x, h.y, i + 1, t, calm);
        ctx.fillStyle = '#8A99AE';
        ctx.textAlign = 'center';
        ctx.fillText(outcropLabels[id], h.x, h.y + 46);
        ctx.textAlign = 'left';
      });
      for (const s of sim.reefKelp) drawKelp(ctx, s, true);
      drawBubbles(ctx, sim.bubbles, sim.pops);

      const sel = selectionRef.current;
      for (const f of sim.fish) {
        drawFish(ctx, f, true, sel?.kind === 'person' && sel.id === f.id);
        sim.hits.push({ x: f.pos.x, y: f.pos.y, r: 44, kind: 'fish', id: f.id });
      }

      const question = questionRef.current;
      drawFarm(
        ctx,
        sim.farm,
        frondRef.current,
        question ?? FARM_EMPTY,
        '',
        { x: W * (1 + FARM_PAD) + 40, y: 70 },
        t,
        calm,
        sim.hits,
      );
      ctx.restore();

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    (canvas as HTMLCanvasElement & { refresh?: () => void }).refresh = resize;

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Roster changed: rebuild the ocean so statuses and colors are current.
  useEffect(() => {
    (canvasRef.current as (HTMLCanvasElement & { refresh?: () => void }) | null)?.refresh?.();
  }, [roster]);

  // Mouse: hit-test fish and fronds in world coordinates.
  const onCanvasClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    if (!sim) return;
    const wx = e.clientX + camAt(sim, performance.now());
    const hit = sim.hits.find((h) => Math.hypot(h.x - wx, e.clientY - h.y) < h.r);
    if (!hit) {
      setSelection(null);
      return;
    }
    setSelection(hit.kind === 'fish' ? { kind: 'person', id: hit.id } : { kind: 'frond', id: hit.id });
  };

  const selectedPerson = selection?.kind === 'person' ? roster.find((p) => p.id === selection.id) : undefined;
  const selectedSource = selection?.kind === 'frond' ? evidence.find((s) => s.id === selection.id) : undefined;

  const open = (sel: Selection, trigger: HTMLElement) => {
    lastTrigger.current = trigger;
    setSelection(sel);
  };

  return (
    <main className="world">
      <canvas ref={canvasRef} className="ocean" onClick={onCanvasClick} aria-hidden="true" />

      <header className="chrome">
        <div className="brand">A-SYNCH</div>
        <nav aria-label="Places">
          <button aria-pressed={view === 'reef'} onClick={() => setTargetView('reef')}>Surface &amp; reef</button>
          <button aria-pressed={view === 'farm'} onClick={() => setTargetView('farm')}>Seaweed farm</button>
          <button onClick={onBack}>Back to ask</button>
          <button aria-haspopup="dialog" onClick={() => setHelpOpen(true)}>Shortcuts</button>
        </nav>
      </header>

      {/* The same people and sources are reachable by keyboard and screen reader. */}
      <section className="roster" aria-label="Team and sources">
        <h2 className="sr-only">Team</h2>
        {rosterError && <p role="alert" className="dim">{rosterError}</p>}
        <ul>
          {roster.map((p) => (
            <li key={p.id}>
              <button onClick={(e) => open({ kind: 'person', id: p.id }, e.currentTarget)}>
                {p.name}, {p.role}, {p.availabilityLabel}
              </button>
            </li>
          ))}
        </ul>
        {fronds.length > 0 && (
          <>
            <h2 className="sr-only">Sources in the last answer</h2>
            <ul>
              {fronds.map((f) => (
                <li key={f.id}>
                  <button onClick={(e) => open({ kind: 'frond', id: f.id }, e.currentTarget)}>
                    {f.label}, {f.detail}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {selectedPerson && (
        <aside className="drawer" aria-labelledby="drawer-title">
          <button className="close" onClick={() => setSelection(null)} aria-label="Close">×</button>
          <div className="mono dim">REEF // {selectedPerson.id.toUpperCase()}</div>
          <h2 id="drawer-title" ref={drawerHeading} tabIndex={-1}>{selectedPerson.name}</h2>
          <p>{selectedPerson.role}</p>
          <p className="dim">{selectedPerson.availabilityLabel}</p>
          <p className="dim">Expertise: {selectedPerson.expertise.join(', ')}</p>
          <p className="dim">Topics: {selectedPerson.topics.join(', ')}</p>
        </aside>
      )}
      {selectedSource && (
        <aside className="drawer" aria-labelledby="drawer-title">
          <button className="close" onClick={() => setSelection(null)} aria-label="Close">×</button>
          <div className="mono dim">FARM // SOURCE</div>
          <h2 id="drawer-title" ref={drawerHeading} tabIndex={-1}>{selectedSource.title}</h2>
          <p className="dim">{selectedSource.sourceLabel} · {selectedSource.timestamp}</p>
          <p>{selectedSource.text}</p>
          {selectedSource.stale && <p className="dim">Out of date. Shown dashed.</p>}
          {selectedSource.securityFlags?.length ? (
            <p className="dim">Flagged: {selectedSource.securityFlags.join(', ')}. Not used as evidence.</p>
          ) : null}
        </aside>
      )}

      <dialog ref={helpRef} className="help" aria-labelledby="help-title" onClose={() => setHelpOpen(false)}>
        <h2 id="help-title">Shortcuts</h2>
        <ul>
          <li><kbd>1</kbd> Surface and reef</li>
          <li><kbd>2</kbd> Seaweed farm</li>
          <li><kbd>?</kbd> Show or hide this list</li>
          <li><kbd>Escape</kbd> Close the drawer or this list</li>
          <li><kbd>Tab</kbd> Move between controls, people, and sources</li>
        </ul>
        <button onClick={() => setHelpOpen(false)}>Close</button>
      </dialog>
    </main>
  );
}

// Kelp uses the Verlet stepper from the simulation module.
function stepKelp(s: Stalk, t: number, dt: number, avoid: Vec[], calm: number) {
  stepStalk(s, t, dt, avoid, calm);
}
