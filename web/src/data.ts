// Visual mapping for the ocean. Names, roles, availability, and colors come from the backend.
import type { TrustDecision } from './contracts';

// The ocean shows three states: available (swims free), focus (shielded, stays home), away (rests).
export type Status = 'available' | 'focus' | 'away';

export type OutcropId = 'backend' | 'quant' | 'design';

// Which coral each person lives near. Unknown people fall back to backend.
const OUTCROP_BY_PERSON: Record<string, OutcropId> = {
  alex: 'backend',
  jordan: 'backend',
  priya: 'quant',
  sam: 'design',
  maya: 'design',
};

export function outcropFor(personId: string): OutcropId {
  return OUTCROP_BY_PERSON[personId] ?? 'backend';
}

export const outcropLabels: Record<OutcropId, string> = {
  backend: 'OUTCROP 01 // BACKEND_CORE',
  quant: 'OUTCROP 02 // QUANT_MODELS',
  design: 'OUTCROP 03 // PRODUCT_DESIGN',
};

export const labelText: Record<TrustDecision, string> = {
  confirmed: 'Confirmed',
  supported: 'Supported',
  'needs-human': 'Needs a person',
};

export const labelHelp: Record<TrustDecision, string> = {
  confirmed: 'Two or more fresh sources agree.',
  supported: 'One fresh source backs this.',
  'needs-human': 'Sources conflict, are out of date, or someone must decide.',
};
