/**
 * Typed access to the Project Atlas context in data/atlas/.
 * Edit the JSON files; this module just loads them.
 */
import type { Evidence, PersonProfile } from "@/lib/contracts";
import peopleJson from "@/data/atlas/people.json";
import evidenceJson from "@/data/atlas/evidence.json";
import expertiseJson from "@/data/atlas/expertise.json";
import metadataJson from "@/data/atlas/trust-metadata.json";

export interface Assertion {
  key: string;
  value: string;
}

export interface RecordMetadata {
  assertions: Assertion[];
  sensitiveTerms?: string[];
  approvalRecord?: boolean;
}

export interface Expertise {
  selectionReason: string;
  knowsAbout: string[];
  owns: string[];
}

export const ATLAS_PEOPLE = peopleJson as PersonProfile[];
export const ATLAS_EVIDENCE = evidenceJson as Evidence[];

const metadata = (metadataJson as { records: Record<string, RecordMetadata> }).records;
const expertise = expertiseJson as unknown as Record<string, Expertise>;

export function getMetadata(evidenceId: string): RecordMetadata {
  return metadata[evidenceId] ?? { assertions: [] };
}

export function getExpertise(personId: string): Expertise | undefined {
  return expertise[personId];
}

export function findEvidence(evidenceId: string, pool: Evidence[] = ATLAS_EVIDENCE) {
  return pool.find((item) => item.id === evidenceId);
}
