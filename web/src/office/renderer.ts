// The seam between the middle end and the visual layer.
// Your pixel-art renderer implements OfficeRenderer: it receives the full state on every change
// (render) and discrete events to animate (event), and reports clicks back through the host.
// It must not change office state itself; it only reports what the user did.
import type { OfficeEvent, OfficeState, RoomId } from './types';
import { GRID } from './layout';
import { STATUS_LABEL } from './types';

export interface RendererHost {
  selectAgent(id: string): void;
  selectRoom(id: RoomId): void;
  hoverAgent(id: string | null): void;
  // Drag a task (plain text) onto an agent.
  dropTask(agentId: string, title: string): void;
}

export interface OfficeRenderer {
  mount(el: HTMLElement, host: RendererHost): void;
  render(state: OfficeState): void;
  event(e: OfficeEvent): void;
  destroy(): void;
}

// ---- Placeholder renderer ----
// Plain DOM so the office is usable before the pixel art lands: rooms are boxes on the tile
// grid, agents are buttons that glide between seats, speech shows as short bubbles.
// Replace it by passing your own OfficeRenderer to <OfficeShell renderer={...} />.

const ICON: Partial<Record<string, string>> = { completed: '✓', 'needs-input': '?', blocked: '!' };

export class PlaceholderRenderer implements OfficeRenderer {
  private root: HTMLElement | null = null;
  private host: RendererHost | null = null;
  private roomEls = new Map<string, HTMLButtonElement>();
  private agentEls = new Map<string, HTMLButtonElement>();
  private bubbleTimers = new Map<string, number>();

  mount(el: HTMLElement, host: RendererHost) {
    this.host = host;
    const root = document.createElement('div');
    root.className = 'ph-office';
    root.style.aspectRatio = `${GRID.w} / ${GRID.h}`;
    el.appendChild(root);
    this.root = root;
  }

  private pct(x: number, total: number) {
    return `${(x / total) * 100}%`;
  }

  render(s: OfficeState) {
    const root = this.root;
    const host = this.host;
    if (!root || !host) return;

    for (const room of Object.values(s.rooms)) {
      let el = this.roomEls.get(room.id);
      if (!el) {
        el = document.createElement('button');
        el.className = 'ph-room';
        el.type = 'button';
        el.addEventListener('click', () => host.selectRoom(room.id));
        el.innerHTML = `<span class="ph-room-name">${room.name}</span>`;
        root.appendChild(el);
        this.roomEls.set(room.id, el);
      }
      el.style.left = this.pct(room.bounds.x, GRID.w);
      el.style.top = this.pct(room.bounds.y, GRID.h);
      el.style.width = this.pct(room.bounds.w, GRID.w);
      el.style.height = this.pct(room.bounds.h, GRID.h);
      const active = Object.values(s.meetings).find((m) => m.room === room.id && m.status !== 'ended');
      el.dataset.state = active?.status ?? '';
      el.setAttribute('aria-label', `${room.name}${active ? `, meeting: ${active.title} (${active.status})` : ''}`);
      el.setAttribute('aria-pressed', String(s.selection?.kind === 'room' && s.selection.id === room.id));
    }

    for (const ag of Object.values(s.agents)) {
      let el = this.agentEls.get(ag.id);
      if (!el) {
        el = document.createElement('button');
        el.type = 'button';
        el.className = 'ph-agent';
        el.innerHTML = '<span class="ph-avatar"></span><span class="ph-icon" aria-hidden="true"></span><span class="ph-name"></span><span class="ph-bubble" aria-hidden="true"></span>';
        el.addEventListener('click', (e) => { e.stopPropagation(); host.selectAgent(ag.id); });
        el.addEventListener('mouseenter', () => host.hoverAgent(ag.id));
        el.addEventListener('mouseleave', () => host.hoverAgent(null));
        el.addEventListener('dragover', (e) => { e.preventDefault(); el!.dataset.drop = 'true'; });
        el.addEventListener('dragleave', () => { el!.dataset.drop = ''; });
        el.addEventListener('drop', (e) => {
          e.preventDefault();
          el!.dataset.drop = '';
          const title = e.dataTransfer?.getData('text/plain');
          if (title) host.dropTask(ag.id, title);
        });
        root.appendChild(el);
        this.agentEls.set(ag.id, el);
      }
      const seat = s.seats[ag.seat];
      if (seat) {
        el.style.left = this.pct(seat.x + 0.5, GRID.w);
        el.style.top = this.pct(seat.y + 0.5, GRID.h);
      }
      el.dataset.status = ag.status;
      el.style.setProperty('--accent', ag.accent);
      (el.querySelector('.ph-avatar') as HTMLElement).textContent = ag.name.split(' ').map((p) => p[0]).join('').slice(0, 2);
      (el.querySelector('.ph-name') as HTMLElement).textContent = `${ag.name.split(' ')[0]} · ${STATUS_LABEL[ag.status]}`;
      (el.querySelector('.ph-icon') as HTMLElement).textContent = ICON[ag.status] ?? '';
      el.setAttribute('aria-label', `${ag.name}, ${ag.role}. ${STATUS_LABEL[ag.status]}: ${ag.statusDetail}`);
      el.setAttribute('aria-pressed', String(s.selection?.kind === 'agent' && s.selection.id === ag.id));
    }
  }

  event(e: OfficeEvent) {
    if (e.type !== 'speech') return;
    const el = this.agentEls.get(e.agentId);
    const bubble = el?.querySelector('.ph-bubble') as HTMLElement | null;
    if (!bubble) return;
    bubble.textContent = e.text.length > 90 ? `${e.text.slice(0, 88)}…` : e.text;
    bubble.dataset.kind = e.kind;
    bubble.dataset.show = 'true';
    const prev = this.bubbleTimers.get(e.agentId);
    if (prev) window.clearTimeout(prev);
    this.bubbleTimers.set(e.agentId, window.setTimeout(() => { bubble.dataset.show = ''; }, 4200));
  }

  destroy() {
    this.bubbleTimers.forEach((t) => window.clearTimeout(t));
    this.root?.remove();
    this.root = null;
  }
}
