import type { Evidence, PersonProfile } from "@/lib/contracts";
// Trust Layer: people and evidence now live in data/corvid-labs/trust/ (built from the Corvid Labs corpus; owned by the
// context/trust stream) so fixtures can be edited without touching code.
import { CORVID_EVIDENCE, CORVID_PEOPLE } from "@/lib/trust/context";

export const DEMO_REQUESTER_ID = "daksh";

export const PEOPLE: PersonProfile[] = CORVID_PEOPLE;

export const EVIDENCE: Evidence[] = CORVID_EVIDENCE;

export function getPerson(personId: string): PersonProfile | undefined {
  return PEOPLE.find((person) => person.id === personId);
}
