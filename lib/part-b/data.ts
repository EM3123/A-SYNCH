import perspectiveJson from "@/data/atlas/perspectives.json";
import { EVIDENCE } from "@/lib/agents/demo-context";
import type { Evidence } from "@/lib/contracts";
import type { PerspectiveRecord } from "@/lib/part-b/types";
import { canAccess, contentWords, isQuarantined, screenEvidence, supportRatio } from "@/lib/trust/checks";
import { trustNow } from "@/lib/trust/policy";

export const PERSPECTIVES = perspectiveJson as PerspectiveRecord[];

export function perspectiveToEvidence(record: PerspectiveRecord): Evidence {
  const text = [
    record.statement,
    `Rationale: ${record.rationale}`,
    `Applies when: ${record.appliesWhen.join("; ")}`,
    `Does not apply when: ${record.doesNotApplyWhen.join("; ")}`,
    `Review questions: ${record.reviewQuestions.join("; ")}`,
    `Scope: ${record.scope}`,
  ].join(" ");
  return {
    id: record.id,
    ownerId: record.ownerId,
    sourceType: record.capturedBy === "voice-debrief" || record.capturedBy === "pre-leave-handoff" ? "meeting" : "note",
    title: record.title,
    sourceLabel: record.sourceLabel,
    timestamp: record.ownerConfirmedAt,
    text,
    permittedUsers: record.permittedUsers,
    kind: "stated-principle",
    ownerApproved: record.ownerApproved,
    securityFlags: record.securityFlags,
  };
}

export const PERSPECTIVE_EVIDENCE = PERSPECTIVES.map(perspectiveToEvidence);
export const ALL_PART_B_EVIDENCE = [...EVIDENCE, ...PERSPECTIVE_EVIDENCE];

export function isPerspectiveActive(record: PerspectiveRecord, now: Date = trustNow()): boolean {
  if (record.revokedAt && new Date(record.revokedAt) <= now) return false;
  if (record.expiresAt && new Date(record.expiresAt) <= now) return false;
  return true;
}

export function accessiblePerspectiveRecords(options: {
  personId: string;
  requesterId: string;
  now?: Date;
}): PerspectiveRecord[] {
  const now = options.now ?? trustNow();
  return PERSPECTIVES.filter((record) => record.ownerId === options.personId)
    .filter((record) => isPerspectiveActive(record, now))
    .filter((record) => canAccess(perspectiveToEvidence(record), options.requesterId));
}

function scoreRecord(record: PerspectiveRecord, query: string): number {
  const queryWords = contentWords(query);
  const recordWords = contentWords([
    record.title,
    record.scope,
    record.statement,
    record.rationale,
    ...record.appliesWhen,
    ...record.doesNotApplyWhen,
    ...record.reviewQuestions,
  ].join(" "));
  let score = 0;
  for (const word of queryWords) if (recordWords.has(word)) score += 1;
  return score;
}

export function retrievePerspective(options: {
  personId: string;
  requesterId: string;
  query: string;
  ids?: string[];
  limit?: number;
  now?: Date;
}) {
  const allowed = accessiblePerspectiveRecords(options).filter((record) => record.ownerApproved);
  const chosen = options.ids?.length
    ? options.ids.map((id) => allowed.find((record) => record.id === id)).filter((record): record is PerspectiveRecord => Boolean(record))
    : allowed
        .map((record) => ({ record, score: scoreRecord(record, options.query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || b.record.ownerConfirmedAt.localeCompare(a.record.ownerConfirmedAt))
        .slice(0, options.limit ?? 4)
        .map((entry) => entry.record);

  const chosenEvidence = chosen.map(perspectiveToEvidence);
  const allAccessible = accessiblePerspectiveRecords({ personId: options.personId, requesterId: options.requesterId, now: options.now })
    .map(perspectiveToEvidence);
  const { ignored } = screenEvidence(allAccessible);
  return {
    records: chosen,
    evidence: chosenEvidence.filter((item) => !isQuarantined(item)),
    ignored,
  };
}

export function findPerspectiveLeaks(text: string, requesterId: string): string[] {
  const lower = text.toLowerCase();
  return PERSPECTIVES.filter((record) => !record.permittedUsers.includes("*") && !record.permittedUsers.includes(requesterId))
    .filter((record) => {
      const terms = record.sensitiveTerms ?? [];
      const termHit = terms.some((term) => lower.includes(term.toLowerCase()));
      return termHit || supportRatio(record.statement, text) >= 0.7;
    })
    .map((record) => record.id);
}
