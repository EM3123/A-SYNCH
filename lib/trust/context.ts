/**
 * Typed access to the Trust Layer dataset in data/corvid-labs/trust/ (built from the
 * Corvid Labs corpus by data/corvid-labs/generator/build_trust.py).
 * Edit the JSON files or rerun the builder; this module just loads them.
 */
import type { Evidence, PersonProfile } from "@/lib/contracts";
import peopleJson from "@/data/corvid-labs/trust/people.json";
import evidenceJson from "@/data/corvid-labs/trust/evidence.json";
import expertiseJson from "@/data/corvid-labs/trust/expertise.json";
import metadataJson from "@/data/corvid-labs/trust/trust-metadata.json";

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

export const CORVID_PEOPLE = peopleJson as PersonProfile[];
export const CORVID_EVIDENCE = evidenceJson as Evidence[];

const metadata = (metadataJson as { records: Record<string, RecordMetadata> }).records;
const expertise = expertiseJson as unknown as Record<string, Expertise>;

export function getMetadata(evidenceId: string): RecordMetadata {
  return metadata[evidenceId] ?? { assertions: [] };
}

export function getExpertise(personId: string): Expertise | undefined {
  return expertise[personId];
}

export function findEvidence(evidenceId: string, pool: Evidence[] = CORVID_EVIDENCE) {
  return pool.find((item) => item.id === evidenceId);
}
