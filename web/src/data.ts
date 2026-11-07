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

// Keep people who share an outcrop visually distinct. Their simulation home
// includes this offset, so normal swimming does not pull their labels together.
const HOME_OFFSET_BY_PERSON: Record<string, number> = {
  alex: -92,
  jordan: 92,
  sam: -92,
  maya: 92,
};

export function homeOffsetFor(personId: string): number {
  return HOME_OFFSET_BY_PERSON[personId] ?? 0;
}

export const outcropLabels: Record<OutcropId, string> = {
  backend: 'OUTCROP 01 // ENGINEERING',
  quant: 'OUTCROP 02 // PRODUCT_STRATEGY',
  design: 'OUTCROP 03 // CUSTOMER_CONTEXT',
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
