// Client for the teammate backend (see src/contracts.ts). The UI never adds words to an answer:
// everything shown as the AI's words comes from brief.answer or a claim in brief.claims.
import type { AskResponse, PersonProfile, Evidence, TrustDecision } from './contracts';

export type { AskResponse, PersonProfile, Evidence, TrustDecision };

export class BackendError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(path, { ...init, signal: ctrl.signal });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) throw new BackendError(body?.error ?? `The backend answered ${res.status}`, res.status);
    return body as T;
  } catch (err) {
    if (err instanceof BackendError) throw err;
    throw new BackendError(
      err instanceof DOMException && err.name === 'AbortError'
        ? 'The backend took too long to answer.'
        : 'The backend is not running. Start it with pnpm dev in the backend folder.',
      null,
    );
  } finally {
    window.clearTimeout(timer);
  }
}

export async function loadPeople(): Promise<PersonProfile[]> {
  const body = await request<{ people: PersonProfile[] }>('/api/people', undefined, 8000);
  return body.people;
}

// Part A: ask the whole team. The answer comes back with the people it selected.
export function askTeam(question: string, requesterId?: string): Promise<AskResponse> {
  return request<AskResponse>('/api/ask', jsonPost({ question, mode: 'team', requesterId }));
}

// Part B: talk directly to one person's context agent.
export function askPerson(personId: string, question: string, requesterId?: string): Promise<AskResponse> {
  return request<AskResponse>(`/api/people/${encodeURIComponent(personId)}/chat`, jsonPost({ question, requesterId }));
}

function jsonPost(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

// Map the backend's availability onto the ocean's visual states.
export function availabilityToStatus(a: PersonProfile['availability']): 'available' | 'focus' | 'away' {
  if (a === 'available') return 'available';
  if (a === 'busy') return 'focus';
  return 'away';
}
