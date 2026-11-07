import type { Evidence, PersonProfile } from "@/lib/contracts";
// Trust Layer: people and evidence now live in data/atlas/ (owned by the
// context/trust stream) so fixtures can be edited without touching code.
import { ATLAS_EVIDENCE, ATLAS_PEOPLE } from "@/lib/trust/context";

export const DEMO_REQUESTER_ID = "daksh";

export const PEOPLE: PersonProfile[] = ATLAS_PEOPLE;

export const EVIDENCE: Evidence[] = ATLAS_EVIDENCE;

export function getPerson(personId: string): PersonProfile | undefined {
  return PEOPLE.find((person) => person.id === personId);
}
